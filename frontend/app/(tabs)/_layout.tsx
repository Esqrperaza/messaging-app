import { Tabs } from 'expo-router';
import React, {useEffect, useState} from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const HOST_URL = 'http://192.168.68.66:3000';

export default function TabLayout() {
  const [hasUnread, setHasUnread] = useState(false);
  const colorScheme = useColorScheme();

  const checkTotalUnread = async () => {
    try {
      const savedId = await AsyncStorage.getItem('userId');
      if (!savedId) return;

      const res = await axios.get(`${HOST_URL}/messages/inbox/${savedId}`);
      const totalUnread = res.data.reduce(
        (sum: number, thread: any) => sum + Number(thread.unread_count || 0),
        0
      );

      setHasUnread(totalUnread > 0);
    } catch (err) {
        console.error('Error checking unread status:', err);
    }
  };

  useEffect(() => {
    checkTotalUnread();
    const interval = setInterval(checkTotalUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: hasUnread ? '' : undefined,
          tabBarBadgeStyle: styles.redDot,
        }}
        />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  redDot: {
    backgroundColor: '#FF3B30',
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
  },
});
