import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const AddTabBarButton = ({ onPress, theme }: any) => {
  const pathname = usePathname();
  const isSelected = pathname?.endsWith('/add') || pathname === '/add';

  return (
    <View style={styles.centerButtonContainer} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[
          styles.centerButton,
          {
            backgroundColor: isSelected ? theme.accent : theme.primary,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <MaterialIcons name="add" size={34} color={theme.background === '#0B0F19' ? '#0B0F19' : '#FFFFFF'} />
      </TouchableOpacity>
    </View>
  );
};

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 66 : 86,
          paddingBottom: Platform.OS === 'android' ? 10 : 28,
          paddingTop: 8,
          position: 'relative',
          elevation: 8,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kayıtlar',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="photo-library" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Yeni Kayıt',
          tabBarLabel: () => null,
          tabBarButton: (props) => <AddTabBarButton {...props} theme={theme} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButtonContainer: {
    top: -28,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 80,
  },
  centerButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
