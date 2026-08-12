import React, { useState, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, View, TextInput, Button, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useLocalSearchParams, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = "http://192.168.68.66:3000"; // USE YOUR MAC IP

interface Message {
//   content: string;
//   conversationId: string;
//   senderId?: string; 
  // Optional, but good to have
  content: string;
  senderId?: string;
  sender_id?: number;
  conversationId?: string;
  conversation_id?: string;
}

export default function Chat() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { targetUserId, targetUsername } = useLocalSearchParams();
  const [myId, setMyId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const flatListRef = useRef<FlatList<Message>>(null);

  const markAsRead = async (currentUserId: number, targetId: string) => {
    try {
        await fetch(`${SOCKET_URL}/messages/read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientId: currentUserId,
                senderId: parseInt(targetId),
            }),
        });
    } catch (error) {
        console.error('Error clearing unread badges:', error);
    }
  };

  useEffect(() => {

    const setupChatandHistory = async () => {
        const savedId = (await AsyncStorage.getItem('userId')) || (await AsyncStorage.getItem('userID'));
            console.log("--- HOOK 1 DEBUG ---");
            console.log("Fetched savedId from disk:", savedId);
            console.log("Target User ID from routing parameters:", targetUserId);
            if (!savedId || !targetUserId){ 
                console.log("❌ Hook 1 halted: Missing savedId or targetUserId");
                return;
            }

            const currentUserId = parseInt(savedId);
            setMyId(currentUserId);

            const sortedIds = [currentUserId, parseInt(targetUserId as string)].sort((a, b) => a - b);
            const roomId = `${sortedIds[0]}_${sortedIds[1]}`;
            setConversationId(roomId);
    
        try {
            const response = await fetch(`${SOCKET_URL}/messages/${roomId}`);
            const data = await response.json();
            if (Array.isArray(data)){
                const normalized = data.map((msg: any) => ({
                content: msg.content,
                senderId: msg.sender_id.toString(),
                conversationId: msg.conversation_id,
                }));

                setChatMessages(normalized);

            } else {
                console.log("History data wasnt an array, setting to empty:", data);
                setChatMessages([]);
            }
        } catch (e) {
            console.error("Failed to load history", e);
            setChatMessages([]);
        }

        markAsRead(currentUserId, targetUserId as string);
    };

    setupChatandHistory();
}, [targetUserId]);

useEffect(() => {

    if (!SOCKET_URL || !conversationId) {
        return;
    }

    const newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        forceNew: true
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server with ID:', newSocket.id);
      newSocket.emit('join_conversation', conversationId);
    });

    newSocket.on('receive_message', (data) => {
      setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), data]);
    });

    return () => {
        console.log('Disconnecting socket...');
        newSocket.disconnect();
    };
  }, [conversationId]);

  const sendMessage = () => {
    console.log("--- SEND PRESS ---");
    console.log("Current Message:", message);
    console.log("Socket Connected?:", socket?.connected);
    console.log("Current myId:", myId);
    console.log("Current conversationId:", conversationId);

    if (message.trim() && socket?.connected && myId) {
      const msgData: Message = { 
        content: message, 
        conversationId,
        senderId: myId ? myId.toString() : undefined
    };
    
    console.log("Emitting msgData:", msgData);

    socket.emit('send_message', msgData);
    setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), msgData]); // See your own message
    setMessage('');
    } else {
    console.log("❌ Message NOT sent. Missing message text or socket connection.");
    }
  };


  return (
    <KeyboardAvoidingView 
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
        <Stack.Screen
            options={{
                headerShown: true,
                title: targetUsername ? `${targetUsername}` : 'Chat',
                headerBackTitle: 'back',
            }}
            />
      <FlatList
        style={{ flex: 1}}
        contentContainerStyle={{ paddingBottom: 15, paddingTop: 15 }}
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item, index) => index.toString()}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
            const sender = item.senderId ?? item.sender_id;
            const isMe = Number(sender) === myId;
            return (
                <View style={[
                    styles.messageBubble,
                    isMe ? styles.myBubble : styles.theirBubble
                ]}>
                    <Text style={isMe ? styles.myText : styles.theirText}>
                        {item.content}
                    </Text>
                </View>
            );
        }}
        />
    <View style={styles.inputContainer}>
      <TextInput 
        style={styles.textInput} 
        value={message} 
        onChangeText={setMessage} 
        placeholder="type message..."
        placeholderTextColor="#8E8E93"
        multiline={true}
      />
      <TouchableOpacity
        style={styles.sendButton}
        onPress={sendMessage}
        disabled={!message.trim()}
       >
        <Text style={styles.sendButtonText}>send</Text>
        </TouchableOpacity>
        </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    // padding: 20, 
    paddingTop: 50 
},
  input: { 
    borderBottomWidth: 1, 
    marginBottom: 10, 
    padding: 8 
},
  msg: { 
    padding: 10, 
    backgroundColor: '#f0f0f0', 
    marginVertical: 5, 
    borderRadius: 5 
},
  messageBubble: {
  padding: 12,
  borderRadius: 16,
  marginVertical: 4,
  maxWidth: '75%',
},
myBubble: {
  backgroundColor: '#007AFF', 
  alignSelf: 'flex-end',
  borderBottomRightRadius: 2, 
},
theirBubble: {
  backgroundColor: '#E5E5EA', 
  alignSelf: 'flex-start',
  borderBottomLeftRadius: 2,
},
myText: { 
    color: '#FFF' 
},
theirText: { 
    color: '#000' 
},
inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Aligns to the bottom if the text box grows
    paddingHorizontal: 10,
    // paddingVertical: 5,
    paddingTop: 5,
    paddingBottom: 35,

    // backgroundColor: '#fff',
    borderTopWidth: 0.25,
    borderColor: '#d4cfcfff',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#e6e6eaff',
    color:'#000',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 12, // Keeps text centered vertically when multiline
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 100, // Stops the box from taking over the screen if they write an essay
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 2, // Minor optical alignment adjustment
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});