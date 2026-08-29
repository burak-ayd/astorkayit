import { Image } from 'expo-image';
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PhotoGridProps {
  photos: string[];
  onAddFromCamera?: () => void;
  onAddFromGallery?: () => void;
  onRemovePhoto?: (index: number) => void;
  onPhotoPress?: (index: number) => void;
  editable?: boolean;
}

export function PhotoGrid({
  photos,
  onAddFromCamera,
  onAddFromGallery,
  onRemovePhoto,
  onPhotoPress,
  editable = false,
}: PhotoGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. TOP: Selected Photos List */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photosScrollContent}
        >
          {photos.map((uri, index) => {
            const formattedUri = uri.startsWith('/') ? 'file://' + uri : uri;
            return (
              <View
                key={index}
                style={[
                  styles.photoItemContainer,
                  {
                    backgroundColor: theme.backgroundSelected,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Pressable
                  style={styles.photoPressable}
                  onPress={() => onPhotoPress && onPhotoPress(index)}
                >
                  <Image
                    source={{ uri: formattedUri }}
                    style={styles.photoImage}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>

                {/* Remove Button if Editable */}
                {editable && onRemovePhoto && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeButton,
                      { backgroundColor: theme.danger },
                      pressed && styles.boxPressed,
                    ]}
                    onPress={() => onRemovePhoto(index)}
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={13} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* 2. BOTTOM: Action Buttons (Camera & Gallery) */}
      {editable && (
        <View style={styles.actionButtonsRow}>
          {onAddFromCamera && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
                pressed && styles.boxPressed,
              ]}
              onPress={onAddFromCamera}
            >
              <MaterialIcons name="photo-camera" size={22} color={theme.accent} />
              <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>
                Kamera ile Çek
              </ThemedText>
            </Pressable>
          )}

          {onAddFromGallery && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
                pressed && styles.boxPressed,
              ]}
              onPress={onAddFromGallery}
            >
              <MaterialIcons name="photo-library" size={22} color={theme.primary} />
              <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>
                Galeriden Seç
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    marginVertical: Spacing.half,
  },
  photosScrollContent: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 4,
    paddingRight: Spacing.two,
  },
  photoItemContainer: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoPressable: {
    width: '100%',
    height: '100%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  boxPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
