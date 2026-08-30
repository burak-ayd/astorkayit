import { create } from 'zustand';
import * as db from '@/database/db';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  defaultHideFromGallery: boolean;
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  setDefaultHideFromGallery: (hide: boolean) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  defaultHideFromGallery: false, // Default: visible in gallery (hide = false)
  themeMode: 'system', // Default: system theme
  notificationsEnabled: true, // Default: enabled
  isLoading: false,

  loadSettings: async () => {
    try {
      set({ isLoading: true });
      const gallerySetting = await db.getSetting('default_hide_from_gallery');
      if (gallerySetting !== null) {
        set({ defaultHideFromGallery: gallerySetting === '1' });
      }

      const themeSetting = await db.getSetting('theme_mode');
      if (themeSetting === 'light' || themeSetting === 'dark' || themeSetting === 'system') {
        set({ themeMode: themeSetting });
      }

      const notifSetting = await db.getSetting('notifications_enabled');
      if (notifSetting !== null) {
        set({ notificationsEnabled: notifSetting === '1' });
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setDefaultHideFromGallery: async (hide: boolean) => {
    try {
      set({ defaultHideFromGallery: hide });
      await db.setSetting('default_hide_from_gallery', hide ? '1' : '0');
    } catch (e) {
      console.warn('Failed to save setting:', e);
    }
  },

  setThemeMode: async (mode: ThemeMode) => {
    try {
      set({ themeMode: mode });
      await db.setSetting('theme_mode', mode);
    } catch (e) {
      console.warn('Failed to save theme mode setting:', e);
    }
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    try {
      set({ notificationsEnabled: enabled });
      await db.setSetting('notifications_enabled', enabled ? '1' : '0');
    } catch (e) {
      console.warn('Failed to save notifications setting:', e);
    }
  },
}));
