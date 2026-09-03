import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { PermissionsScreen } from '@/components/permissions-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useRecordStore } from '@/store/useRecordStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import MediaStorageModule from '../../modules/my-module/src/MediaStorageModule';

import { CustomAlertModal } from '@/components/ui/CustomAlertModal';

import {
  initNotifications,
  setupNotificationResponseListener,
} from '@/services/notificationService';
import {
  ensureBackgroundTaskRegistered,
  checkAndRunFallbackSync,
} from '@/services/backgroundSyncService';
import 'expo-blob';
import { useDriveStore } from '@/store/useDriveStore';
import { showAlert } from '@/store/useAlertStore';

export default function RootLayout() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [cameraPermission] = useCameraPermissions();
  const [mediaPermission] = ImagePicker.useMediaLibraryPermissions();

  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);
  const [forceShowApp, setForceShowApp] = useState(false);

  const loadRecords = useRecordStore((s) => s.loadRecords);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const isCameraGranted = cameraPermission?.granted ?? false;
  const isMediaGranted = mediaPermission?.granted ?? false;
  const allPermissionsGranted = (isCameraGranted && isMediaGranted) || forceShowApp;

  useEffect(() => {
    initNotifications();
    const cleanup = setupNotificationResponseListener();
    return cleanup;
  }, []);

  // Bölüm 1+3: Görev kaydını doğrula + kaynak etiketli foreground fallback
  useEffect(() => {
    if (!allPermissionsGranted) return;

    const checkBackgroundTasks = async () => {
      try {
        // Görev kaydını doğrula (kaybolmuşsa yeniden kaydet, zinciri sıfırla)
        await ensureBackgroundTaskRegistered();

        // Fallback: son yedekleme durumuna göre aksiyon al
        const fallback = await checkAndRunFallbackSync();
        if (!fallback.needed) return;

        const driveState = useDriveStore.getState();
        if (!driveState.isConnected || driveState.isSyncing) return;

        if (fallback.mode === 'auto') {
          // 20-24 saat arası: sessizce foreground sync başlat
          console.log(
            `🔄 [Fallback Auto] Son yedekleme ${fallback.hoursSince} saat önce. Sessiz foreground sync.`,
          );
          const records = useRecordStore.getState().records;
          await driveState.syncNow(records);
        } else {
          // prompt: kullanıcıya sor (24+ saat veya hiç sync yok)
          const message =
            fallback.hoursSince < 0
              ? 'Henüz hiç yedekleme yapılmamış. Şimdi yedeklemek ister misiniz?'
              : `Son yedeklemenizin üzerinden ${fallback.hoursSince} saatten fazla zaman geçti. Şimdi yedeklemek ister misiniz?`;

          showAlert({
            title: 'Yedekleme Hatırlatması',
            message,
            type: 'warning',
            buttons: [
              { text: 'Sonra', style: 'cancel' },
              {
                text: 'Şimdi Yedekle',
                onPress: async () => {
                  const records = useRecordStore.getState().records;
                  await driveState.syncNow(records);
                },
              },
            ],
          });
        }
      } catch (e) {
        console.warn('Arka plan görev kontrolü hatası:', e);
      }
    };

    checkBackgroundTasks();
  }, [allPermissionsGranted]);

  useEffect(() => {
    if (cameraPermission !== null && mediaPermission !== null) {
      setHasCheckedPermissions(true);
    }
  }, [cameraPermission, mediaPermission]);

  useEffect(() => {
    if (allPermissionsGranted) {
      loadSettings();
      // Initialize directories & load records
      if (MediaStorageModule) {
        MediaStorageModule.initializeDirectories()
          .then(() => loadRecords())
          .catch((err) => console.warn('Init directories failed:', err));
      } else {
        loadRecords();
      }
    }
  }, [allPermissionsGranted, loadRecords, loadSettings]);

  if (!hasCheckedPermissions) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color="#3478F6" />
      </View>
    );
  }

  if (!allPermissionsGranted) {
    return <PermissionsScreen onAllPermissionsGranted={() => setForceShowApp(true)} />;
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="detail/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Kayıt Detayı',
            headerBackTitle: 'Geri',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.background },
          }}
        />
      </Stack>
      <CustomAlertModal />
    </>
  );
}
