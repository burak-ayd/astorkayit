import { Image } from 'expo-image';
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecordItem } from '@/types';

interface RecordCardProps {
  record: RecordItem;
  onPress: () => void;
  onDelete?: () => void;
}

export function RecordCard({ record, onPress }: RecordCardProps) {
  const theme = useTheme();
  const firstPhoto = record.photos.length > 0 ? record.photos[0] : null;
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
    <Pressable
      style={({ pressed }) => [
        styles.cardContainer,
        {
          shadowColor: theme.shadow,
        },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <ThemedView
        type="backgroundElement"
        style={[
          styles.cardContent,
          {
            borderColor: theme.border,
            borderWidth: 1,
          },
        ]}
      >
        {/* Thumbnail or Icon */}
        <View style={[styles.thumbnailWrapper, { backgroundColor: theme.backgroundSelected }]}>
          {firstPhoto ? (
            <Image
              source={{ uri: firstPhoto.startsWith('/') ? 'file://' + firstPhoto : firstPhoto }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <MaterialIcons name="photo-library" size={28} color={theme.textMuted} />
            </View>
          )}

          {/* Photo Count Badge */}
          {record.photos.length > 1 && (
            <View style={styles.photoCountBadge}>
              <MaterialIcons name="collections" size={11} color="#ffffff" />
              <ThemedText style={styles.photoCountText}>
                {record.photos.length}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Text Details */}
        <View style={styles.detailsWrapper}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
              {record.title}
            </ThemedText>
            {record.is_hidden && (
              <MaterialIcons name="visibility-off" size={16} color={theme.warning} />
            )}
          </View>

          {record.description ? (
            <ThemedText type="small" style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
              {record.description}
            </ThemedText>
          ) : null}

          {/* Date & Time Footer */}
          <View style={styles.footerRow}>
            <View style={styles.dateBadge}>
              <MaterialIcons name="event" size={13} color={theme.primary} />
              <ThemedText type="small" style={[styles.dateText, { color: theme.textSecondary }]}>
                {formattedDate} • {formattedTime}
              </ThemedText>
            </View>

            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    marginVertical: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardContent: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.three,
    alignItems: 'center',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#000000B0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  detailsWrapper: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    fontSize: 16,
    flex: 1,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
  },
});
