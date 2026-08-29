import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRecordStore } from '@/store/useRecordStore';
import { ThemeMode, useSettingsStore } from '@/store/useSettingsStore';
import MediaStorageModule from '../../../modules/my-module/src/MediaStorageModule';

export default function SettingsScreen() {
  const theme = useTheme();
  const stats = useRecordStore((s) => s.stats);
  const loadStats = useRecordStore((s) => s.loadStats);
  const clearAllRecords = useRecordStore((s) => s.clearAllRecords);

  const defaultHideFromGallery = useSettingsStore((s) => s.defaultHideFromGallery);
  const setDefaultHideFromGallery = useSettingsStore((s) => s.setDefaultHideFromGallery);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [isProcessing, setIsProcessing] = useState(false);
  const [basePath, setBasePath] = useState<string>('');

  const checkStatus = useCallback(() => {
    if (!MediaStorageModule || Platform.OS !== 'android') return;
    try {
      const path = MediaStorageModule.getMediaBasePath();
      if (path) setBasePath(path);
    } catch (e) {
      console.warn('Status check failed:', e);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadSettings();
    checkStatus();
  }, [loadStats, loadSettings, checkStatus]);

  const handleToggleDefaultHide = async (val: boolean) => {
    await setDefaultHideFromGallery(val);
  };

  const handleSelectTheme = async (mode: ThemeMode) => {
    await setThemeMode(mode);
  };

  const handleRescan = async () => {
    if (!MediaStorageModule || Platform.OS !== 'android') return;
    try {
      setIsProcessing(true);
      await MediaStorageModule.scanFile('Files');
      Alert.alert(
        'Tamamlandı ✅',
        'Tüm medya dosyaları Android MediaStore ile eşitlendi.'
      );
    } catch (e) {
      Alert.alert('Hata', String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Tüm Verileri Sil ⚠️',
      'Tüm anı kayıtları ve kaydedilen fotoğraflar kalıcı olarak silinecek. Bu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hepsini Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              await clearAllRecords();
              Alert.alert('Başarılı', 'Tüm kayıtlar ve fotoğraflar silindi.');
            } catch (e) {
              Alert.alert('Hata', 'Kayıtlar silinemedi: ' + String(e));
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const cardStyle = [
    styles.card,
    {
      borderColor: theme.border,
      borderWidth: 1,
      shadowColor: theme.shadow,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Ayarlar & Depolama
            </ThemedText>
            <ThemedText type="small" style={[styles.headerSub, { color: theme.textSecondary }]}>
              Uygulama tercihleri ve depolama yönetimi
            </ThemedText>
          </View>

          {/* Theme & Appearance Card */}
          <ThemedView type="backgroundElement" style={cardStyle}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="palette" size={22} color={theme.primary} />
              <View style={styles.cardHeaderTexts}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  Görünüm & Tema
                </ThemedText>
                <ThemedText type="small" style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  Uygulama renk temasını belirleyin
                </ThemedText>
              </View>
            </View>

            <View style={[styles.themeSelectorRow, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
              {/* System Theme Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.themeOptionBtn,
                  themeMode === 'system' && { backgroundColor: theme.primary },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleSelectTheme('system')}
              >
                <MaterialIcons
                  name="settings-brightness"
                  size={20}
                  color={themeMode === 'system' ? (theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff') : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.themeOptionText,
                    { color: themeMode === 'system' ? (theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff') : theme.textSecondary },
                  ]}
                >
                  Sistem
                </ThemedText>
              </Pressable>

              {/* Light Theme Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.themeOptionBtn,
                  themeMode === 'light' && { backgroundColor: theme.primary },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleSelectTheme('light')}
              >
                <MaterialIcons
                  name="light-mode"
                  size={20}
                  color={themeMode === 'light' ? (theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff') : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.themeOptionText,
                    { color: themeMode === 'light' ? (theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff') : theme.textSecondary },
                  ]}
                >
                  Aydınlık
                </ThemedText>
              </Pressable>

              {/* Dark Theme Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.themeOptionBtn,
                  themeMode === 'dark' && { backgroundColor: theme.primary },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleSelectTheme('dark')}
              >
                <MaterialIcons
                  name="dark-mode"
                  size={20}
                  color={themeMode === 'dark' ? (theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff') : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.themeOptionText,
                    { color: themeMode === 'dark' ? (theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff') : theme.textSecondary },
                  ]}
                >
                  Karanlık
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          {/* Storage Stats Card */}
          <ThemedView type="backgroundElement" style={cardStyle}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="pie-chart" size={22} color={theme.primary} />
              <ThemedText type="smallBold" style={styles.cardTitle}>
                Kullanım İstatistikleri
              </ThemedText>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText style={[styles.statNumber, { color: theme.primary }]}>{stats.totalRecords}</ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Toplam Kayıt
                </ThemedText>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText style={[styles.statNumber, { color: theme.primary }]}>{stats.totalPhotos}</ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Toplam Fotoğraf
                </ThemedText>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText style={[styles.statNumber, { color: theme.primary }]}>{formatSize(stats.totalSizeBytes)}</ThemedText>
                <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Disk Kullanımı
                </ThemedText>
              </View>
            </View>

            {basePath !== '' && (
              <View style={[styles.pathBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText type="small" style={[styles.pathLabel, { color: theme.textSecondary }]}>
                  Depolama Yolu:
                </ThemedText>
                <ThemedText type="code" style={[styles.pathValue, { color: theme.text }]}>
                  {basePath}
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* Global Default Gallery Visibility Card */}
          <ThemedView type="backgroundElement" style={cardStyle}>
            <View style={styles.cardHeader}>
              <MaterialIcons
                name={defaultHideFromGallery ? 'visibility-off' : 'visibility'}
                size={24}
                color={defaultHideFromGallery ? theme.warning : theme.primary}
              />
              <View style={styles.cardHeaderTexts}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  Varsayılan Galeri Görünürlüğü (Global)
                </ThemedText>
                <ThemedText type="small" style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  {defaultHideFromGallery
                    ? 'Yeni kayıtlar varsayılan olarak cihaz galerisinden GİZLENİR.'
                    : 'Yeni kayıtlar varsayılan olarak cihaz galerisinde GÖRÜNÜR.'}
                </ThemedText>
              </View>
              <Switch
                value={defaultHideFromGallery}
                onValueChange={handleToggleDefaultHide}
                trackColor={{
                  false: theme.border,
                  true: theme.warning,
                }}
                thumbColor="#ffffff"
              />
            </View>
          </ThemedView>

          {/* Tools & Rescan Card */}
          <ThemedView type="backgroundElement" style={cardStyle}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="sync" size={22} color={theme.accent} />
              <View style={styles.cardHeaderTexts}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  Medya Veritabanı Senkronizasyonu
                </ThemedText>
                <ThemedText type="small" style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  Tüm fotoğrafları Android sistem medya tarayıcısıyla yeniden eşitleyin
                </ThemedText>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: theme.primaryMuted, borderColor: theme.border, borderWidth: 1 },
                pressed && styles.buttonPressed,
                isProcessing && styles.buttonDisabled,
              ]}
              onPress={handleRescan}
              disabled={isProcessing}
            >
              <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                🔄 Galeri Veritabanını Yeniden Tara
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* Danger Zone */}
          <ThemedView type="backgroundElement" style={[...cardStyle, { borderColor: theme.dangerMuted, borderWidth: 1.5 }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="warning" size={22} color={theme.danger} />
              <View style={styles.cardHeaderTexts}>
                <ThemedText type="smallBold" style={[styles.cardTitle, { color: theme.danger }]}>
                  Tehlikeli Bölge
                </ThemedText>
                <ThemedText type="small" style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  Tüm veritabanını ve kayıtlı tüm medya dosyalarını kalıcı olarak temizler
                </ThemedText>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: theme.dangerMuted, borderColor: theme.danger, borderWidth: 1 },
                pressed && styles.buttonPressed,
                isProcessing && styles.buttonDisabled,
              ]}
              onPress={handleClearAll}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <ThemedText style={[styles.actionBtnText, { color: theme.danger }]}>
                  🗑️ Tüm Kayıtları ve Fotoğrafları Sil
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    gap: 2,
    paddingTop: Spacing.one,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: 5,
    borderRadius: 14,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statBox: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  pathBox: {
    padding: Spacing.two,
    borderRadius: 12,
    gap: 2,
  },
  pathLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  pathValue: {
    fontSize: 11,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
