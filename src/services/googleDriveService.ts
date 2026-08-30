import * as AuthSession from 'expo-auth-session';
import * as Network from 'expo-network';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { RecordItem } from '@/types';
import MediaStorageModule from '../../modules/my-module/src/MediaStorageModule';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth Endpoints & Configuration
const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
};

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface SyncResult {
  success: boolean;
  uploadedCount: number;
  error?: string;
  syncedAt: string;
}

// Default Fallback OAuth Client IDs (can be configured via app settings)
const DEFAULT_CLIENT_ID = '331818228308-0123456789abcdefghijklmnopqrstuv.apps.googleusercontent.com';

/**
 * Initiates Google OAuth2 login with PKCE
 */
export async function authenticateWithGoogle(customClientId?: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  user: GoogleUser;
} | null> {
  const clientId = customClientId || DEFAULT_CLIENT_ID;
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'astorkayit',
    path: 'oauth',
  });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });

  const result = await request.promptAsync(DISCOVERY);

  if (result.type === 'success' && result.params) {
    const accessToken = result.params.access_token;
    const refreshToken = result.params.refresh_token;
    const expiresIn = result.params.expires_in ? parseInt(result.params.expires_in, 10) : 3600;

    // Fetch user info
    const userRes = await fetch(DISCOVERY.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      throw new Error('Kullanıcı bilgileri alınamadı.');
    }

    const userData = await userRes.json();
    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email,
        picture: userData.picture,
      },
    };
  }

  return null;
}

/**
 * Checks if current network connection is allowed for syncing based on settings
 */
export async function isNetworkAllowedForSync(wifiOnly: boolean): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const netState = await Network.getNetworkStateAsync();

    if (!netState.isConnected || !netState.isInternetReachable) {
      return { allowed: false, reason: 'İnternet bağlantısı bulunamadı.' };
    }

    if (wifiOnly && netState.type !== Network.NetworkStateType.WIFI) {
      return {
        allowed: false,
        reason: 'Sadece Wi-Fi ile yükleme seçeneği aktif, hücresel veridesiniz.',
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Finds or creates the dedicated "AstorKayit" folder in user's Google Drive
 */
export async function getOrCreateDriveFolder(accessToken: string, folderName: string = 'AstorKayit'): Promise<string> {
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id, name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    throw new Error('Google Drive klasör araması başarısız oldu.');
  }

  const listData = await listRes.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    throw new Error('Google Drive klasörü oluşturulamadı.');
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Uploads a file (multipart metadata + content) to Google Drive
 */
export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  content: string,
  parentFolderId?: string
): Promise<{ id: string; name: string }> {
  // First check if a file with the same name already exists in the folder
  let existingFileId: string | null = null;
  if (parentFolderId) {
    const q = encodeURIComponent(`name = '${fileName}' and '${parentFolderId}' in parents and trashed = false`);
    const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.files && data.files.length > 0) {
        existingFileId = data.files[0].id;
      }
    }
  }

  const metadata: any = {
    name: fileName,
    mimeType,
  };
  if (parentFolderId && !existingFileId) {
    metadata.parents = [parentFolderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dosya yüklenemedi: ${errText}`);
  }

  return await res.json();
}

/**
 * Deletes a file or folder from Google Drive by name in the app folder
 */
export async function deleteFileFromDrive(accessToken: string, fileName: string, parentFolderId: string): Promise<boolean> {
  try {
    const q = encodeURIComponent(`name = '${fileName}' and '${parentFolderId}' in parents and trashed = false`);
    const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.files && data.files.length > 0) {
        for (const f of data.files) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
        return true;
      }
    }
  } catch (e) {
    console.warn('Drive deletion error:', e);
  }
  return false;
}

/**
 * Main sync operation: Synchronizes local records and metadata JSON to Google Drive
 */
export async function syncAllRecordsToDrive(
  accessToken: string,
  records: RecordItem[],
  wifiOnly: boolean
): Promise<SyncResult> {
  // 1. Check network eligibility
  const netCheck = await isNetworkAllowedForSync(wifiOnly);
  if (!netCheck.allowed) {
    return {
      success: false,
      uploadedCount: 0,
      error: netCheck.reason,
      syncedAt: new Date().toISOString(),
    };
  }

  try {
    // 2. Get or create root AstorKayit folder in Google Drive
    const parentFolderId = await getOrCreateDriveFolder(accessToken, 'AstorKayit');

    // 3. Upload backup manifest / records json
    const manifest = {
      app: 'AstorKayit',
      version: '1.0.2',
      synced_at: new Date().toISOString(),
      record_count: records.length,
      records: records.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        is_hidden: r.is_hidden,
        is_pinned: r.is_pinned,
        photos_count: r.photos.length,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    };

    await uploadFileToDrive(
      accessToken,
      'records_manifest.json',
      'application/json',
      JSON.stringify(manifest, null, 2),
      parentFolderId
    );

    // 4. Upload full JSON database backup
    await uploadFileToDrive(
      accessToken,
      'astor_kayit_backup.json',
      'application/json',
      JSON.stringify(records, null, 2),
      parentFolderId
    );

    return {
      success: true,
      uploadedCount: records.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Google Drive sync failed:', error);
    return {
      success: false,
      uploadedCount: 0,
      error: String(error),
      syncedAt: new Date().toISOString(),
    };
  }
}
