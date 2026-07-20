import React, { useEffect, useState } from 'react';
import { StyleSheet, FlatList, View, Text, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import axios from 'axios';
import { useRouter, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatThread {
  conversation_id: string;
  last_message: string;
  last_message_time: string;
  last_sender_id: number;
  target_user_id: number;
  target_username: string;
  target_profile_picture: string | null;
}

export default function MessagesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<number | null>(null);

  const HOST_URL = 'http://192.168.68.66:3000';

  const fetchInbox = async () => {
    try {
      const savedId = await AsyncStorage.getItem('userId');
      if (!savedId) return;
      
      const currentUserId = parseInt(savedId);
      setMyId(currentUserId);

      const res = await axios.get(`${HOST_URL}/messages/inbox/${currentUserId}`);
      setThreads(res.data);
    } catch (err) {
      console.error("Error pulling inbox data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Pull inbox data when screen mounts or when the user focuses on this tab
  useEffect(() => {
    fetchInbox();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchInbox();
    });
    return unsubscribe;
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Messages</Text>
      
      {threads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active conversations yet.</Text>
          <Text style={styles.emptySubtext}>Head over to the Nearby list to start a chat!</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.conversation_id}
          refreshing={loading}
          onRefresh={fetchInbox}
          renderItem={({ item }) => {
            const avatarUri = item.target_profile_picture
              ? `${HOST_URL}${item.target_profile_picture}`
              : null;
            
            const isMeLastSender = item.last_sender_id === myId;

            return (
              <TouchableOpacity
                style={styles.threadCard}
                onPress={() => router.push({
                  pathname: '/chat',
                  params: {
                    conversationId: item.conversation_id,
                    targetUserId: String(item.target_user_id),
                    targetUsername: item.target_username
                  }
                })}
              >
                {/* Profile Picture */}
                <View style={styles.avatarContainer}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.placeholderText}>
                        {item.target_username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Thread Snippet Content */}
                <View style={styles.threadDetails}>
                  <View style={styles.row}>
                    <Text style={styles.usernameText}>{item.target_username}</Text>
                    <Text style={styles.timeText}>
                      {new Date(item.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  
                  <Text style={styles.messageSnippet} numberOfLines={1}>
                    {isMeLastSender ? `You: ${item.last_message}` : `Them: ${item.last_message}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 8 },
  threadCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#E1E1E1' },
  avatarPlaceholder: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  threadDetails: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  usernameText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  timeText: { fontSize: 13, color: '#8E8E93' },
  messageSnippet: { fontSize: 14, color: '#8E8E93' }
});