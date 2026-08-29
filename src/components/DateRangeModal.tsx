import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DateFilter } from '@/types';

interface DateRangeModalProps {
  visible: boolean;
  onClose: () => void;
  currentFilter: DateFilter;
  onApply: (filter: DateFilter) => void;
  onReset: () => void;
}

export function DateRangeModal({
  visible,
  onClose,
  currentFilter,
  onApply,
  onReset,
}: DateRangeModalProps) {
  const theme = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(currentFilter.startDate);
  const [endDate, setEndDate] = useState<Date | null>(currentFilter.endDate);

  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setActivePicker(null);
      return;
    }

    if (selectedDate) {
      if (activePicker === 'start') {
        setStartDate(selectedDate);
      } else if (activePicker === 'end') {
        setEndDate(selectedDate);
      }
    }
    setActivePicker(null);
  };

  const handleApply = () => {
    onApply({ startDate, endDate });
    onClose();
  };

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    onReset();
    onClose();
  };

  const formatDate = (d: Date | null) => {
    if (!d) return 'Tarih Seçiniz';
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView
          type="backgroundElement"
          style={[
            styles.modalContainer,
            {
              borderTopColor: theme.border,
              borderTopWidth: 1,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <MaterialIcons name="date-range" size={22} color={theme.primary} />
              <ThemedText type="smallBold" style={styles.modalTitle}>
                Tarih Aralığı Filtresi
              </ThemedText>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Date Pickers Section */}
          <View style={styles.datesSection}>
            {/* Start Date */}
            <View style={styles.dateField}>
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Başlangıç Tarihi
              </ThemedText>
              <Pressable
                style={({ pressed }) => [
                  styles.dateButton,
                  {
                    backgroundColor: startDate ? theme.primaryMuted : theme.background,
                    borderColor: startDate ? theme.primary : theme.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setActivePicker('start')}
              >
                <MaterialIcons
                  name="calendar-today"
                  size={18}
                  color={startDate ? theme.primary : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.dateBtnText,
                    {
                      color: startDate ? theme.primary : theme.textMuted,
                      fontWeight: startDate ? '600' : '400',
                    },
                  ]}
                >
                  {formatDate(startDate)}
                </ThemedText>
              </Pressable>
            </View>

            {/* End Date */}
            <View style={styles.dateField}>
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Bitiş Tarihi
              </ThemedText>
              <Pressable
                style={({ pressed }) => [
                  styles.dateButton,
                  {
                    backgroundColor: endDate ? theme.primaryMuted : theme.background,
                    borderColor: endDate ? theme.primary : theme.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setActivePicker('end')}
              >
                <MaterialIcons
                  name="event"
                  size={18}
                  color={endDate ? theme.primary : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.dateBtnText,
                    {
                      color: endDate ? theme.primary : theme.textMuted,
                      fontWeight: endDate ? '600' : '400',
                    },
                  ]}
                >
                  {formatDate(endDate)}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Native Picker Trigger */}
          {activePicker && (
            <DateTimePicker
              value={
                activePicker === 'start'
                  ? startDate || new Date()
                  : endDate || new Date()
              }
              mode="date"
              display={Platform.OS === 'android' ? 'default' : 'spinner'}
              onChange={handleDateChange}
            />
          )}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.resetBtn,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.buttonPressed,
              ]}
              onPress={handleReset}
            >
              <ThemedText style={[styles.resetBtnText, { color: theme.textSecondary }]}>
                Filtreyi Temizle
              </ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.applyBtn,
                { backgroundColor: theme.primary },
                pressed && styles.buttonPressed,
              ]}
              onPress={handleApply}
            >
              <ThemedText
                style={[
                  styles.applyBtnText,
                  { color: theme.background === '#0B0F19' ? '#0B0F19' : '#ffffff' },
                ]}
              >
                Uygula
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.four,
    gap: Spacing.four,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  modalTitle: {
    fontSize: 18,
  },
  datesSection: {
    gap: Spacing.three,
  },
  dateField: {
    gap: Spacing.half,
  },
  fieldLabel: {
    fontSize: 13,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  dateBtnText: {
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
