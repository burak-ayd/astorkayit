import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewerModal } from '@/components/ImageViewerModal';
import { PhotoGrid } from '@/components/PhotoGrid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import * as db from '@/database/db';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/store/useAlertStore';
import { useRecordStore } from '@/store/useRecordStore';
import type { RecordItem } from '@/types';
import MediaStorageModule from '../../../modules/my-module/src/MediaStorageModule';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const toggleRecordVisibility = useRecordStore((s) => s.toggleRecordVisibility);

  const [record, setRecord] = useState<RecordItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

  const fetchRecord = useCallback(() => {
    const numId = parseInt(id || '', 10);
    if (!isNaN(numId) && numId > 0) {
      db.getRecordById(numId)
        .then((rec) => {
          setRecord(rec);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load record:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const handleToggleVisibility = async () => {
    if (!record) return;
    try {
      setIsTogglingVisibility(true);
      const newHiddenState = !record.is_hidden;
      await toggleRecordVisibility(record.id, newHiddenState);
      fetchRecord();

      showAlert({
        title: newHiddenState ? 'Galeriden Gizlendi 🙈' : 'Galeride Görünür 👁️',
        message: newHiddenState
          ? 'Bu kaydın fotoğrafları cihaz galerisinden gizlendi (.nomedia eklendi).'
          : 'Bu kaydın fotoğrafları cihaz galerisinde görünür yapıldı.',
        type: 'info',
      });
    } catch (e) {
      showAlert({
        title: 'Hata',
        message: 'Görünürlük ayarı değiştirilemedi: ' + String(e),
        type: 'danger',
      });
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleDelete = () => {
    if (!record) return;

    showAlert({
      title: 'Kaydı Sil 🗑️',
      message: `"${record.title}" başlıklı anı kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      type: 'danger',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteRecord(record.id);
              showAlert({
                title: 'Silindi',
                message: 'Kayıt başarıyla silindi.',
                type: 'success',
                buttons: [
                  {
                    text: 'Tamam',
                    onPress: () => router.back(),
                  },
                ],
              });
            } catch (e) {
              showAlert({
                title: 'Hata',
                message: 'Kayıt silinirken bir hata oluştu: ' + String(e),
                type: 'danger',
              });
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    });
  };

  const handleShare = async () => {
    if (!record) return;
    const dateStr = new Date(record.created_at).toLocaleDateString('tr-TR');
    const timeStr = new Date(record.created_at).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const message = `📋 ${record.title}\n\n${record.description ? record.description + '\n\n' : ''}📅 Tarih: ${dateStr} ${timeStr}${
      record.photos.length > 0 ? `\n📸 ${record.photos.length} Adet Fotoğraf` : ''
    }`;

    try {
      if (MediaStorageModule && record.photos.length > 0) {
        await MediaStorageModule.shareMediaFiles(record.photos, record.title, message);
      } else {
        await Share.share({
          title: record.title,
          message,
        });
      }
    } catch (error) {
      console.error('Paylaşım hatası:', error);
      try {
        await Share.share({
          title: record.title,
          message,
        });
      } catch {
        showAlert({
          title: 'Hata',
          message: 'Paylaşım başlatılamadı.',
          type: 'danger',
        });
      }
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!record) {
    return (
      <ThemedView style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color={theme.danger} />
        <ThemedText type="smallBold" style={{ marginTop: 12 }}>
          Kayıt bulunamadı
        </ThemedText>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: theme.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backBtnText}>Geri Dön</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const dateObj = new Date(record.created_at);
  const formattedDate = dateObj.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Title and Date Card */}
          <ThemedView
            type="backgroundElement"
            style={[
              styles.headerCard,
              {
                borderColor: theme.border,
                borderWidth: 1,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.titleShareRow}>
              <ThemedText type="subtitle" style={styles.titleText}>
                {record.title}
              </ThemedText>
              <Pressable
                style={({ pressed }) => [
                  styles.shareIconBtn,
                  { backgroundColor: theme.primaryMuted },
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleShare}
                hitSlop={8}
              >
                <MaterialIcons name="share" size={20} color={theme.primary} />
              </Pressable>
            </View>

            <View style={styles.dateRow}>
              <MaterialIcons name="event" size={16} color={theme.primary} />
              <ThemedText type="small" style={[styles.dateText, { color: theme.primary }]}>
                {formattedDate} • {formattedTime}
              </ThemedText>
            </View>
          </ThemedView>

          {/* Gallery Visibility Status & Toggle Card */}
          <ThemedView
            type="backgroundElement"
            style={[
              styles.visibilityCard,
              {
                borderColor: theme.border,
                borderWidth: 1,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.visibilityHeaderRow}>
              <MaterialIcons
                name={record.is_hidden ? 'visibility-off' : 'visibility'}
                size={22}
                color={record.is_hidden ? theme.warning : theme.success}
              />
              <View style={styles.visibilityTexts}>
                <ThemedText type="smallBold">
                  {record.is_hidden ? 'Cihaz Galerisinde Gizli' : 'Cihaz Galerisinde Görünür'}
                </ThemedText>
                <ThemedText type="small" style={[styles.visibilitySub, { color: theme.textSecondary }]}>
                  {record.is_hidden
                    ? 'Fotoğraflar genel galeride görünmez (.nomedia aktif).'
                    : 'Fotoğraflar cihazın galeri uygulamasında görüntülenir.'}
                </ThemedText>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.visibilityToggleBtn,
                {
                  backgroundColor: record.is_hidden ? theme.success : theme.warning,
                },
                pressed && styles.buttonPressed,
                isTogglingVisibility && styles.buttonDisabled,
              ]}
              onPress={handleToggleVisibility}
              disabled={isTogglingVisibility}
            >
              {isTogglingVisibility ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <ThemedText style={styles.visibilityToggleBtnText}>
                  {record.is_hidden
                    ? '👁️ Galeride Görünür Yap'
                    : '🙈 Galeriden Gizle (.nomedia)'}
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>

          {/* Description Card if available */}
          {record.description ? (
            <ThemedView
              type="backgroundElement"
              style={[
                styles.descriptionCard,
                {
                  borderColor: theme.border,
                  borderWidth: 1,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Açıklama & Notlar
              </ThemedText>
              <ThemedText style={[styles.descriptionText, { color: theme.textSecondary }]}>
                {record.description}
              </ThemedText>
            </ThemedView>
          ) : null}

          {/* Photos Gallery Card */}
          <ThemedView
            type="backgroundElement"
            style={[
              styles.photosCard,
              {
                borderColor: theme.border,
                borderWidth: 1,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.photosCardHeader}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Fotoğraflar ({record.photos.length})
              </ThemedText>
              <ThemedText type="small" style={[styles.photoHint, { color: theme.textMuted }]}>
                Büyütmek için dokunun
              </ThemedText>
            </View>

            <PhotoGrid
              photos={record.photos}
              editable={false}
              onPhotoPress={(index) => setSelectedPhotoIndex(index)}
            />
          </ThemedView>

          {/* Delete Action Button */}
          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              {
                backgroundColor: theme.dangerMuted,
                borderColor: theme.danger,
              },
              isDeleting && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={theme.danger} size="small" />
            ) : (
              <>
                <MaterialIcons name="delete-outline" size={20} color={theme.danger} />
                <ThemedText style={[styles.deleteButtonText, { color: theme.danger }]}>
                  Kaydı Sil
                </ThemedText>
              </>
            )}
          </Pressable>
        </ScrollView>

        {/* Fullscreen Photo Viewer */}
        <ImageViewerModal
          visible={selectedPhotoIndex !== null}
          photos={record.photos}
          initialIndex={selectedPhotoIndex ?? 0}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  headerCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.two,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  titleShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  shareIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontWeight: '600',
    fontSize: 13,
  },
  visibilityCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  visibilityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  visibilityTexts: {
    flex: 1,
    gap: 2,
  },
  visibilitySub: {
    fontSize: 12,
  },
  visibilityToggleBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityToggleBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  descriptionCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.two,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 15,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  photosCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.two,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  photosCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoHint: {
    fontSize: 11,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
