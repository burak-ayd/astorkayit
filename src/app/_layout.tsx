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
import '@/services/backgroundSyncService';
import 'expo-blob';

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
