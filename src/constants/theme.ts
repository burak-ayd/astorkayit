import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    background: '#EEF2F6', // More distinct, crisp background that makes white cards pop
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E2E8F0',
    border: '#E2E8F0',
    primary: '#2563EB',
    primaryMuted: '#EFF6FF',
    accent: '#0284C7',
    success: '#10B981',
    successMuted: '#ECFDF5',
    warning: '#F59E0B',
    warningMuted: '#FFFBEB',
    danger: '#EF4444',
    dangerMuted: '#FEF2F2',
    card: '#FFFFFF',
    shadow: '#0F172A',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    background: '#0B0F19',
    backgroundElement: '#161F30',
    backgroundSelected: '#223048',
    border: '#1E293B',
    primary: '#38BDF8',
    primaryMuted: '#0C4A6E40',
    accent: '#60A5FA',
    success: '#34D399',
    successMuted: '#064E3B40',
    warning: '#FBBF24',
    warningMuted: '#78350F40',
    danger: '#F87171',
    dangerMuted: '#7F1D1D40',
    card: '#161F30',
    shadow: '#000000',
  },
} as const;

export type ThemeColors = (typeof Colors)[keyof typeof Colors];
export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
