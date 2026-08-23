import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import React, { useEffect } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

interface PermissionsScreenProps {
  onAllPermissionsGranted: () => void;
}

export function PermissionsScreen({ onAllPermissionsGranted }: PermissionsScreenProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  const isCameraGranted = cameraPermission?.granted ?? false;
  const isMediaGranted = mediaPermission?.granted ?? false;
  const allGranted = isCameraGranted && isMediaGranted;

  useEffect(() => {
    if (allGranted) {
      onAllPermissionsGranted();
    }
  }, [allGranted, onAllPermissionsGranted]);

  const handleRequestAll = async () => {
    let camStatus = cameraPermission?.status;
    if (!isCameraGranted) {
      const res = await requestCameraPermission();
      camStatus = res.status;
    }

    let mediaStatus = mediaPermission?.status;
    if (!isMediaGranted) {
      const res = await requestMediaPermission();
      mediaStatus = res.status;
    }

    if (camStatus === ImagePicker.PermissionStatus.GRANTED && mediaStatus === ImagePicker.PermissionStatus.GRANTED) {
      onAllPermissionsGranted();
    } else if (
      (cameraPermission && !cameraPermission.canAskAgain && !isCameraGranted) ||
      (mediaPermission && !mediaPermission.canAskAgain && !isMediaGranted)
    ) {
      Alert.alert(
        'İzin Gerekli',
        'Bazı izinler kalıcı olarak reddedilmiş. Lütfen uygulama ayarlarından izinleri etkinleştirin.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleRequestCamera = async () => {
    if (!cameraPermission?.canAskAgain && !isCameraGranted) {
      Linking.openSettings();
      return;
    }
    await requestCameraPermission();
  };

  const handleRequestMedia = async () => {
    if (!mediaPermission?.canAskAgain && !isMediaGranted) {
      Linking.openSettings();
      return;
    }
    await requestMediaPermission();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <ThemedText style={styles.headerIcon}>🔐</ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.title}>
            İzin Yönetimi
          </ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            Astor Kayıt anı defterinizi kullanabilmek, fotoğraf ve video ekleyip depolayabilmek için aşağıdaki izinlere ihtiyaç duyuyoruz.
          </ThemedText>
        </View>

        {/* Permissions List */}
        <View style={styles.permissionsContainer}>
          {/* Camera Permission Card */}
          <ThemedView type="backgroundElement" style={styles.permissionCard}>
            <View style={styles.permissionIconBadge}>
              <ThemedText style={styles.permissionEmoji}>📸</ThemedText>
            </View>
            <View style={styles.permissionDetails}>
              <View style={styles.permissionHeaderRow}>
                <ThemedText type="smallBold">Kamera İzni</ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    isCameraGranted ? styles.statusBadgeGranted : styles.statusBadgePending,
                  ]}
                >
                  <ThemedText style={styles.statusBadgeText}>
                    {isCameraGranted ? 'Verildi' : 'Gerekli'}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={styles.permissionDesc}>
                Anılarınıza yeni fotoğraf ve video çekip kaydedebilmeniz için gereklidir.
              </ThemedText>
              {!isCameraGranted && (
                <Pressable
                  style={({ pressed }) => [
                    styles.singleGrantButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleRequestCamera}
                >
                  <ThemedText style={styles.singleGrantButtonText}>
                    {!cameraPermission?.canAskAgain ? 'Ayarlardan İzin Ver' : 'Kamera İzni Ver'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </ThemedView>

          {/* Media / Gallery Permission Card */}
          <ThemedView type="backgroundElement" style={styles.permissionCard}>
            <View style={styles.permissionIconBadge}>
              <ThemedText style={styles.permissionEmoji}>🖼️</ThemedText>
            </View>
            <View style={styles.permissionDetails}>
              <View style={styles.permissionHeaderRow}>
                <ThemedText type="smallBold">Galeri / Medya İzni</ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    isMediaGranted ? styles.statusBadgeGranted : styles.statusBadgePending,
                  ]}
                >
                  <ThemedText style={styles.statusBadgeText}>
                    {isMediaGranted ? 'Verildi' : 'Gerekli'}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={styles.permissionDesc}>
                Galerinizdeki mevcut fotoğraf ve videoları anılarınıza eklemek için gereklidir.
              </ThemedText>
              {!isMediaGranted && (
                <Pressable
                  style={({ pressed }) => [
                    styles.singleGrantButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleRequestMedia}
                >
                  <ThemedText style={styles.singleGrantButtonText}>
                    {!mediaPermission?.canAskAgain ? 'Ayarlardan İzin Ver' : 'Galeri İzni Ver'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </ThemedView>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              allGranted && styles.primaryButtonSuccess,
              pressed && styles.buttonPressed,
            ]}
            onPress={allGranted ? onAllPermissionsGranted : handleRequestAll}
          >
            <ThemedText style={styles.primaryButtonText}>
              {allGranted ? 'Uygulamaya Devam Et ➔' : 'Tüm İzinleri Ver'}
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.settingsLinkButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => Linking.openSettings()}
          >
            <ThemedText type="small" style={styles.settingsLinkText}>
              ⚙️ Cihaz Uygulama Ayarlarını Aç
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3478F615',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  headerIcon: {
    fontSize: 32,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.65,
    paddingHorizontal: Spacing.two,
    lineHeight: 18,
  },
  permissionsContainer: {
    gap: Spacing.three,
  },
  permissionCard: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.three,
  },
  permissionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#3478F618',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionEmoji: {
    fontSize: 22,
  },
  permissionDetails: {
    flex: 1,
    gap: Spacing.one,
  },
  permissionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permissionDesc: {
    opacity: 0.6,
    lineHeight: 16,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeGranted: {
    backgroundColor: '#34C75925',
  },
  statusBadgePending: {
    backgroundColor: '#FF950025',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  singleGrantButton: {
    marginTop: Spacing.one,
    backgroundColor: '#3478F620',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  singleGrantButtonText: {
    color: '#3478F6',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomActions: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#3478F6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3478F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonSuccess: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  settingsLinkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  settingsLinkText: {
    opacity: 0.6,
    fontSize: 13,
  },
});
