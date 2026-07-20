import React, { useEffect, useState } from 'react';
import { StyleSheet, FlatList, View, Text, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: number;
  username: string;
  bio: string;
  age: number;
  gender: string;
  distance?: number;
  profile_picture_url?: string; //added a profile pic
}
export default function HomeScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const HOST_URL = 'http://192.168.68.66:3000';
  const NEARBY_URL = `${HOST_URL}/users/nearby`;

  useEffect(() => {
    const checkUserId = async () => {
      const savedId = await AsyncStorage.getItem('userId');
      const savedToken = await AsyncStorage.getItem('userToken');

      console.log("--- Auth Adit ---");
      console.log("Stored User ID: ", savedId);
      console.log("Sgtored Token: ", savedToken ? "valid (hidden)" : "Missing");
    };

    checkUserId();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserClick = (user: { id: number, username: string }) => {
    router.push({
      pathname: '/chat',
      params: {
        targetUserId: String(user.id),
        targetUsername: user.username
      }
    });
  };
  const fetchUsers = async () => {
    try {
      const MOCK_TOKEN = "YOUR_JWT_TOKEN_HERE";

      const res = await axios.get(NEARBY_URL, {
        params: {
          lat: 33.9533,
          lng: -117.3961,
          radius: 50
        },
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`
        }
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Discovery Error:", err);
    } finally{
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={() => router.push('/chat')} 
        style={{backgroundColor: '#007AFF', padding: 15, marginTop: 20, marginHorizontal: 20, borderRadius: 10}}
      >
    <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>Go to Test Chat</Text>
  </TouchableOpacity>

      {/* --- TEMPORARY LOGIN BUTTON --- */}
      <TouchableOpacity 
        onPress={() => router.push('/login')} 
        style={{backgroundColor: 'black', padding: 15, marginTop: 60, marginHorizontal: 20, borderRadius: 10}}
      >
        <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>Go to Login Screen</Text>
      </TouchableOpacity>

      {/* --- TEMPORARY PROFILE BUTTON --- */}
      <TouchableOpacity
        onPress={() => router.push('/profile')}
      style={{backgroundColor: 'black', padding: 15, marginTop: 60, marginHorizontal: 20, borderRadius: 10}}
      >
        <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>Profile Settings</Text>
      </TouchableOpacity>


      <Text style={styles.title}>Users Nearby</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const avatarUri = item.profile_picture_url
            ? `${HOST_URL}${item.profile_picture_url}`
            : null;

          return (
            <TouchableOpacity
              style={styles.userCard}
              onPress={() => handleUserClick(item)}
            >
              <View style={styles.avatarContainer}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.userAvatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.placeholderText}>
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username}</Text>
        <Text style={styles.userAge}>{item.age}</Text>
        <Text style={styles.userBio}>{item.bio}</Text>
        <Text style={styles.userGender}>{item.gender}</Text>

        {item.distance && (
          <Text style={styles.userDistance}>
            {Number(item.distance).toFixed(1)} miles away
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  loader: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 20 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatarContainer: { marginRight: 15 },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1E1E1',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1E1E1',
    marginRight: 15,
  },
  userInfo: {
    flex: 1, // 
    justifyContent: 'center',
  },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  userAge: { fontSize: 14, color: '#666', marginTop: 4 },
  userBio: { fontSize: 14, color: '#666', marginTop: 4 },
  userGender: { fontSize: 14, color: '#666', marginTop: 4 },
  
placeholderText: {
  color: "#666",
  fontWeight: "bold",
  textAlign: "center",
  lineHeight: 50,
},
userDistance: {
  marginTop: 4,
  color: "#666",
},

});