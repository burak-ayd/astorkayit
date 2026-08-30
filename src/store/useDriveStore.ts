import { create } from 'zustand';
import * as db from '@/database/db';
import type { RecordItem } from '@/types';
import {
  authenticateWithGoogle,
  deleteFileFromDrive,
  getOrCreateDriveFolder,
  GoogleUser,
  syncAllRecordsToDrive,
  SyncResult,
} from '@/services/googleDriveService';

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

      set({
        isConnected,
        user,
        accessToken,
        autoSyncEnabled: autoSync === '1',
        syncOnWifiOnly: wifiOnly !== '0', // default true
        deleteFromDriveOnLocalDelete: deletePolicy === '1',
        lastSyncTime: lastSync || null,
        clientId: customClientId || '',
      });
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
    } catch (e) {
      console.error('Drive disconnect error:', e);
    }
  },

  setAutoSync: async (enabled: boolean) => {
    set({ autoSyncEnabled: enabled });
    await db.setSetting('gdrive_auto_sync', enabled ? '1' : '0');
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
    const { accessToken, isConnected, syncOnWifiOnly } = get();

    if (!isConnected || !accessToken) {
      const errRes: SyncResult = {
        success: false,
        uploadedCount: 0,
        error: 'Google Drive hesabı bağlı değil.',
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
      } else {
        set({ lastSyncResult: result });
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
      return errRes;
    } finally {
      set({ isSyncing: false });
    }
  },

  handleRecordDeleteSync: async (recordTitle: string, recordId: number) => {
    const { isConnected, accessToken, deleteFromDriveOnLocalDelete } = get();
    if (!isConnected || !accessToken || !deleteFromDriveOnLocalDelete) return;

    try {
      const parentFolderId = await getOrCreateDriveFolder(accessToken, 'AstorKayit');
      // If folder or files were named with record id
      const folderName = `record_${recordId}_${recordTitle}`;
      await deleteFileFromDrive(accessToken, folderName, parentFolderId);
    } catch (e) {
      console.warn('Delete sync error:', e);
    }
  },
}));
