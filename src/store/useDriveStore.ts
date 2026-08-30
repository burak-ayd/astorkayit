import { create } from 'zustand';
import * as db from '@/database/db';
import type { RecordItem } from '@/types';
import {
  authenticateWithGoogle,
  deleteFileFromDrive,
  getFreshAccessToken,
  getOrCreateDriveFolder,
  GoogleUser,
  syncAllRecordsToDrive,
  SyncResult,
} from '@/services/googleDriveService';
import { sendTaskNotification } from '@/services/notificationService';
import {
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
} from '@/services/backgroundSyncService';

interface DriveState {
  isConnected: boolean;
  user: GoogleUser | null;
  accessToken: string | null;
  autoSyncEnabled: boolean;
  syncOnWifiOnly: boolean;
  deleteFromDriveOnLocalDelete: boolean;
  lastSyncTime: string | null;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  clientId: string;

  // Actions
  loadDriveSettings: () => Promise<void>;
  connectWithGoogle: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setAutoSync: (enabled: boolean) => Promise<void>;
  setSyncWifiOnly: (wifiOnly: boolean) => Promise<void>;
  setDeletePolicy: (deleteOnLocalDelete: boolean) => Promise<void>;
  setClientId: (clientId: string) => Promise<void>;
  syncNow: (records: RecordItem[]) => Promise<SyncResult>;
  handleRecordDeleteSync: (recordTitle: string, recordId: number) => Promise<void>;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  isConnected: false,
  user: null,
  accessToken: null,
  autoSyncEnabled: false,
  syncOnWifiOnly: true,
  deleteFromDriveOnLocalDelete: false,
  lastSyncTime: null,
  isSyncing: false,
  lastSyncResult: null,
  clientId: '',

  loadDriveSettings: async () => {
    try {
      const accessToken = await db.getSetting('gdrive_access_token');
      const userEmail = await db.getSetting('gdrive_user_email');
      const userName = await db.getSetting('gdrive_user_name');
      const userPicture = await db.getSetting('gdrive_user_picture');
      const autoSync = await db.getSetting('gdrive_auto_sync');
      const wifiOnly = await db.getSetting('gdrive_wifi_only');
      const deletePolicy = await db.getSetting('gdrive_delete_policy');
      const lastSync = await db.getSetting('gdrive_last_sync');
      const customClientId = await db.getSetting('gdrive_client_id');

      const isConnected = !!accessToken && !!userEmail;
      const user = isConnected
        ? {
            id: 'google-user',
            email: userEmail || '',
            name: userName || userEmail || '',
            picture: userPicture || undefined,
          }
        : null;

      const isAutoSync = autoSync === '1';
      set({
        isConnected,
        user,
        accessToken,
        autoSyncEnabled: isAutoSync,
        syncOnWifiOnly: wifiOnly !== '0', // default true
        deleteFromDriveOnLocalDelete: deletePolicy === '1',
        lastSyncTime: lastSync || null,
        clientId: customClientId || '',
      });

      if (isConnected && isAutoSync) {
        await registerBackgroundSyncTask();
      }
    } catch (e) {
      console.warn('Loading Drive settings failed:', e);
    }
  },

  connectWithGoogle: async () => {
    try {
      const { clientId } = get();
      const authResult = await authenticateWithGoogle(clientId || undefined);

      if (authResult) {
        const { accessToken, user } = authResult;

        // Persist credentials
        await db.setSetting('gdrive_access_token', accessToken);
        await db.setSetting('gdrive_user_email', user.email);
        await db.setSetting('gdrive_user_name', user.name);
        if (user.picture) {
          await db.setSetting('gdrive_user_picture', user.picture);
        }

        set({
          isConnected: true,
          accessToken,
          user,
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('Google login error:', e);
      throw e;
    }
  },

  disconnect: async () => {
    try {
      await db.setSetting('gdrive_access_token', '');
      await db.setSetting('gdrive_user_email', '');
      await db.setSetting('gdrive_user_name', '');
      await db.setSetting('gdrive_user_picture', '');

      set({
        isConnected: false,
        user: null,
        accessToken: null,
      });
      await unregisterBackgroundSyncTask();
    } catch (e) {
      console.error('Drive disconnect error:', e);
    }
  },

  setAutoSync: async (enabled: boolean) => {
    set({ autoSyncEnabled: enabled });
    await db.setSetting('gdrive_auto_sync', enabled ? '1' : '0');
    if (enabled) {
      await registerBackgroundSyncTask();
    } else {
      await unregisterBackgroundSyncTask();
    }
  },

  setSyncWifiOnly: async (wifiOnly: boolean) => {
    set({ syncOnWifiOnly: wifiOnly });
    await db.setSetting('gdrive_wifi_only', wifiOnly ? '1' : '0');
  },

  setDeletePolicy: async (deleteOnLocalDelete: boolean) => {
    set({ deleteFromDriveOnLocalDelete: deleteOnLocalDelete });
    await db.setSetting('gdrive_delete_policy', deleteOnLocalDelete ? '1' : '0');
  },

  setClientId: async (clientId: string) => {
    set({ clientId });
    await db.setSetting('gdrive_client_id', clientId);
  },

  syncNow: async (records: RecordItem[]) => {
    let { accessToken, isConnected, syncOnWifiOnly } = get();

    if (!isConnected) {
      const errRes: SyncResult = {
        success: false,
        uploadedCount: 0,
        error: 'Google Drive hesabı bağlı değil.',
        syncedAt: new Date().toISOString(),
      };
      set({ lastSyncResult: errRes });
      return errRes;
    }

    // Google Play Services üzerinden taze token al
    const freshToken = await getFreshAccessToken();
    if (freshToken) {
      accessToken = freshToken;
      set({ accessToken: freshToken });
    }

    if (!accessToken) {
      const errRes: SyncResult = {
        success: false,
        uploadedCount: 0,
        error: 'Google Drive oturumu geçersiz veya erişim belirteci alınamadı. Lütfen tekrar giriş yapın.',
        syncedAt: new Date().toISOString(),
      };
      set({ lastSyncResult: errRes });
      return errRes;
    }

    try {
      set({ isSyncing: true });
      const result = await syncAllRecordsToDrive(accessToken, records, syncOnWifiOnly);

      if (result.success) {
        const now = new Date().toISOString();
        await db.setSetting('gdrive_last_sync', now);
        set({ lastSyncTime: now, lastSyncResult: result });

        await sendTaskNotification({
          title: 'Google Drive Eşitlendi ☁️',
          body: `${result.uploadedCount} adet anı kaydı ve tüm fotoğrafları Google Drive'a başarıyla yedeklendi.`,
          alertTitle: 'Senkronizasyon Başarılı',
          alertMessage: `${result.uploadedCount} adet kayıt ve fotoğrafları Google Drive ile başarıyla eşitlendi.`,
          alertType: 'success',
          actionType: 'drive_sync',
        });
      } else {
        set({ lastSyncResult: result });

        await sendTaskNotification({
          title: 'Senkronizasyon Uyarısı ⚠️',
          body: result.error || 'Yedekleme tamamlanamadı.',
          alertTitle: 'Senkronizasyon Uyarısı',
          alertMessage: result.error || 'Yedekleme tamamlanamadı.',
          alertType: 'warning',
          actionType: 'drive_sync',
        });
      }

      return result;
    } catch (e) {
      const errRes: SyncResult = {
        success: false,
        uploadedCount: 0,
        error: String(e),
        syncedAt: new Date().toISOString(),
      };
      set({ lastSyncResult: errRes });

      await sendTaskNotification({
        title: 'Senkronizasyon Hatası ❌',
        body: String(e),
        alertTitle: 'Senkronizasyon Hatası',
        alertMessage: String(e),
        alertType: 'danger',
        actionType: 'drive_sync',
      });

      return errRes;
    } finally {
      set({ isSyncing: false });
    }
  },

  handleRecordDeleteSync: async (recordTitle: string, recordId: number) => {
    const { isConnected, accessToken, deleteFromDriveOnLocalDelete } = get();
    if (!isConnected || !accessToken || !deleteFromDriveOnLocalDelete) return;

    try {
      const rootFolderId = await getOrCreateDriveFolder(accessToken, 'AstorKayit');
      const filesFolderId = await getOrCreateDriveFolder(accessToken, 'Files', rootFolderId);
      const folderName = db.getRecordFolderName(recordId, recordTitle);
      await deleteFileFromDrive(accessToken, folderName, filesFolderId);
    } catch (e) {
      console.warn('Delete sync error:', e);
    }
  },
}));
