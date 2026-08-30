import * as SQLite from 'expo-sqlite';
import type { RecordItem, StorageStats } from '@/types';
import MediaStorageModule from '../../modules/my-module/src/MediaStorageModule';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getRecordFolderName(id: number, title: string): string {
  const cleanTitle = title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim();
  return `record_${id}_${cleanTitle || 'kayit'}`;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('astor_kayit.db');

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          is_hidden INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL,
          uri TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Safe column migrations
      try {
        await db.execAsync(`
          ALTER TABLE records ADD COLUMN is_hidden INTEGER DEFAULT 0;
        `);
      } catch {
        // Column already exists
      }

      try {
        await db.execAsync(`
          ALTER TABLE records ADD COLUMN is_pinned INTEGER DEFAULT 0;
        `);
      } catch {
        // Column already exists
      }

      return db;
    })().catch((err) => {
      // If initialization fails, reset dbPromise so next call retries
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  interface SettingRow {
    value: string;
  }
  const row = await db.getFirstAsync<SettingRow>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getAllRecords(): Promise<RecordItem[]> {
  const db = await getDatabase();

  interface RecordRow {
    id: number;
    title: string;
    description: string | null;
    is_hidden: number | null;
    is_pinned: number | null;
    created_at: string;
    updated_at: string;
  }

  interface PhotoRow {
    id: number;
    record_id: number;
    uri: string;
  }

  const recordRows = await db.getAllAsync<RecordRow>(
    'SELECT * FROM records ORDER BY is_pinned DESC, datetime(created_at) DESC'
  );

  const photoRows = await db.getAllAsync<PhotoRow>(
    'SELECT * FROM photos ORDER BY id ASC'
  );

  const photosMap = new Map<number, string[]>();
  for (const photo of photoRows) {
    const list = photosMap.get(photo.record_id) || [];
    list.push(photo.uri);
    photosMap.set(photo.record_id, list);
  }

  return recordRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || '',
    photos: photosMap.get(r.id) || [],
    is_hidden: r.is_hidden === 1,
    is_pinned: r.is_pinned === 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function getRecordById(id: number): Promise<RecordItem | null> {
  if (!id || isNaN(id) || id <= 0) return null;

  const db = await getDatabase();

  interface RecordRow {
    id: number;
    title: string;
    description: string | null;
    is_hidden: number | null;
    is_pinned: number | null;
    created_at: string;
    updated_at: string;
  }

  interface PhotoRow {
    uri: string;
  }

  const record = await db.getFirstAsync<RecordRow>(
    'SELECT * FROM records WHERE id = ?',
    [id]
  );

  if (!record) return null;

  const photoRows = await db.getAllAsync<PhotoRow>(
    'SELECT uri FROM photos WHERE record_id = ? ORDER BY id ASC',
    [id]
  );

  return {
    id: record.id,
    title: record.title,
    description: record.description || '',
    photos: photoRows.map((p) => p.uri),
    is_hidden: record.is_hidden === 1,
    is_pinned: record.is_pinned === 1,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export async function insertRecord(
  title: string,
  description: string,
  rawPhotoUris: string[],
  isHidden: boolean = false
): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // 1. Create record row in SQLite first to obtain auto-increment ID
  const result = await db.runAsync(
    'INSERT INTO records (title, description, is_hidden, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [title, description || '', isHidden ? 1 : 0, now, now]
  );

  const recordId = result.lastInsertRowId;
  const folderName = getRecordFolderName(recordId, title);

  // 2. Save each photo to unique record folder: Files/record_<id>_<record_name>/
  const finalPhotoPaths: string[] = [];

  for (let i = 0; i < rawPhotoUris.length; i++) {
    const rawUri = rawPhotoUris[i];
    let targetPath = rawUri;

    if (MediaStorageModule) {
      const timestamp = Date.now() + i;
      const ext = rawUri.split('.').pop()?.split('?')[0] || 'jpg';
      const destinationRelPath = `Files/${folderName}/photo_${i + 1}_${timestamp}.${ext}`;

      try {
        const saved = await MediaStorageModule.saveMediaFile(rawUri, destinationRelPath);
        if (saved.success) {
          targetPath = saved.path;
        }
      } catch (e) {
        console.warn('Saving photo to record folder failed:', e);
      }
    }

    finalPhotoPaths.push(targetPath);

    await db.runAsync(
      'INSERT INTO photos (record_id, uri, created_at) VALUES (?, ?, ?)',
      [recordId, targetPath, now]
    );
  }

  // 3. If hidden, create .nomedia inside the record's dedicated folder
  if (isHidden && MediaStorageModule) {
    try {
      await MediaStorageModule.createNoMedia(`Files/${folderName}`);
    } catch (e) {
      console.warn('Failed to set .nomedia for record folder:', e);
    }
  }

  return recordId;
}

export async function setRecordGalleryVisibility(
  recordId: number,
  hideFromGallery: boolean
): Promise<void> {
  if (!recordId || isNaN(recordId)) return;

  const db = await getDatabase();

  interface RecordRow {
    title: string;
  }
  const record = await db.getFirstAsync<RecordRow>(
    'SELECT title FROM records WHERE id = ?',
    [recordId]
  );

  if (record && MediaStorageModule) {
    const folderName = getRecordFolderName(recordId, record.title);
    if (hideFromGallery) {
      await MediaStorageModule.createNoMedia(`Files/${folderName}`);
    } else {
      await MediaStorageModule.removeNoMedia(`Files/${folderName}`);
    }
  }

  await db.runAsync(
    'UPDATE records SET is_hidden = ?, updated_at = ? WHERE id = ?',
    [hideFromGallery ? 1 : 0, new Date().toISOString(), recordId]
  );
}

export async function updateRecord(
  id: number,
  title: string,
  description: string,
  photoUris: string[],
  isHidden?: boolean
): Promise<void> {
  if (!id || isNaN(id)) return;

  const db = await getDatabase();
  const now = new Date().toISOString();
  const folderName = getRecordFolderName(id, title);

  if (isHidden !== undefined) {
    await db.runAsync(
      'UPDATE records SET title = ?, description = ?, is_hidden = ?, updated_at = ? WHERE id = ?',
      [title, description || '', isHidden ? 1 : 0, now, id]
    );
  } else {
    await db.runAsync(
      'UPDATE records SET title = ?, description = ?, updated_at = ? WHERE id = ?',
      [title, description || '', now, id]
    );
  }

  // Re-save photos
  await db.runAsync('DELETE FROM photos WHERE record_id = ?', [id]);

  for (let i = 0; i < photoUris.length; i++) {
    const rawUri = photoUris[i];
    let targetPath = rawUri;

    // If it's a new URI not yet in this record's folder
    if (MediaStorageModule && !rawUri.includes(`Files/${folderName}/`)) {
      const timestamp = Date.now() + i;
      const ext = rawUri.split('.').pop()?.split('?')[0] || 'jpg';
      const destinationRelPath = `Files/${folderName}/photo_${i + 1}_${timestamp}.${ext}`;

      try {
        const saved = await MediaStorageModule.saveMediaFile(rawUri, destinationRelPath);
        if (saved.success) {
          targetPath = saved.path;
        }
      } catch (e) {
        console.warn('Saving updated photo to record folder failed:', e);
      }
    }

    await db.runAsync(
      'INSERT INTO photos (record_id, uri, created_at) VALUES (?, ?, ?)',
      [id, targetPath, now]
    );
  }
}

export async function deleteRecord(id: number): Promise<void> {
  if (!id || isNaN(id)) return;

  const db = await getDatabase();

  interface RecordRow {
    title: string;
  }
  interface PhotoRow {
    uri: string;
  }

  const record = await db.getFirstAsync<RecordRow>(
    'SELECT title FROM records WHERE id = ?',
    [id]
  );
  const photos = await db.getAllAsync<PhotoRow>(
    'SELECT uri FROM photos WHERE record_id = ?',
    [id]
  );

  // 1. Delete record's folder from disk (Files/record_<id>_<record_name>)
  if (MediaStorageModule) {
    if (record) {
      const folderName = getRecordFolderName(id, record.title);
      try {
        await MediaStorageModule.deleteDirectory(`Files/${folderName}`);
      } catch (e) {
        console.warn('Failed to delete directory by record name:', e);
      }
    }

    // Also check photos to ensure directory cleanup if path was different
    for (const photo of photos) {
      if (photo.uri) {
        const parts = photo.uri.split('/');
        const dirIndex = parts.indexOf('Files');
        if (dirIndex !== -1 && parts[dirIndex + 1]) {
          const actualDir = `Files/${parts[dirIndex + 1]}`;
          try {
            await MediaStorageModule.deleteDirectory(actualDir);
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  // 2. Delete from SQLite (cascade deletes photos table entries)
  await db.runAsync('DELETE FROM records WHERE id = ?', [id]);
}

export async function deleteAllRecords(): Promise<void> {
  const db = await getDatabase();

  interface RecordRow {
    id: number;
    title: string;
  }

  const allRecords = await db.getAllAsync<RecordRow>('SELECT id, title FROM records');

  // Delete all record directories from disk
  if (MediaStorageModule) {
    for (const rec of allRecords) {
      const folderName = getRecordFolderName(rec.id, rec.title);
      try {
        await MediaStorageModule.deleteDirectory(`Files/${folderName}`);
      } catch (e) {
        console.warn(`Failed to delete ${folderName} directory:`, e);
      }
    }
  }

  await db.execAsync(`
    DELETE FROM photos;
    DELETE FROM records;
  `);
}

export async function getStorageStats(): Promise<StorageStats> {
  const db = await getDatabase();

  interface CountRow {
    count: number;
  }

  const recCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) as count FROM records');
  const photoCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) as count FROM photos');

  let totalSize = 0;
  if (MediaStorageModule) {
    try {
      const files = await MediaStorageModule.listFiles('Files');
      totalSize = files.reduce((acc, f) => acc + f.size, 0);
    } catch (e) {
      console.warn('Listing files for stats failed:', e);
    }
  }

  return {
    totalRecords: recCount?.count ?? 0,
    totalPhotos: photoCount?.count ?? 0,
    totalSizeBytes: totalSize,
  };
}

export async function setRecordsPinStatus(
  ids: number[],
  isPinned: boolean
): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE records SET is_pinned = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [isPinned ? 1 : 0, new Date().toISOString(), ...ids]
  );
}

export async function setMultipleRecordsGalleryVisibility(
  ids: number[],
  hideFromGallery: boolean
): Promise<void> {
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    await setRecordGalleryVisibility(id, hideFromGallery);
  }
}

export async function deleteMultipleRecords(ids: number[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    await deleteRecord(id);
  }
}
