import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BASE_URL = "http://192.168.68.66:3000";

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      const savedId = await AsyncStorage.getItem('userId');
      if (savedId) {
        setUserId(savedId);
        fetchUserProfile(savedId);
      }
    };
    loadUserData();
  }, []);

  const fetchUserProfile = async (id: string) => {
    try {
      const res = await axios.get(`${BASE_URL}/users`);
      const currentUser = res.data.find((u: any) => u.id === parseInt(id));
      if (currentUser && currentUser.profile_picture_url) {
        setImageUri(`${BASE_URL}${currentUser.profile_picture_url}`);
      }
    } catch (err) {
      console.error("Error loading user profile data:", err);
    }
  };

  const pickImage = async () => {
    // Request permission to comply with mobile policies
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [1, 1], // Perfect square crop for profiles
      quality: 0.7,   // Compress slightly to keep payload snappy
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      const selectedUri = result.assets[0].uri;
      setImageUri(selectedUri);
      uploadImage(selectedUri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!userId) return;
    setUploading(true);

    // Build the multipart payload mapping
    const formData = new FormData();
    
    // Resolve clean local OS type string metadata
    const uriParts = uri.split('.');
    const fileType = uriParts[uriParts.length - 1];

    formData.append('avatar', {
      uri: uri,
      name: `avatar-${userId}.${fileType}`,
      type: `image/${fileType}`,
    } as any);

    try {
      const response = await axios.post(`${BASE_URL}/users/${userId}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setImageUri(`${BASE_URL}${response.data.user.profile_picture_url}`)
      Alert.alert("Success 🎉", "Profile picture updated!");
      console.log("Upload response details:", response.data);
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      Alert.alert("Upload Error", "Failed to transfer file to the server.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Settings</Text>
      
      <TouchableOpacity onPress={pickImage} disabled={uploading}>
        <View style={styles.avatarContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.placeholderText}>Add Photo</Text>
            </View>
          )}
          {uploading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="small" color="#FFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Text style={styles.infoText}>Tap the bubble to change your profile photo.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 40 },
  avatarContainer: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', marginBottom: 20, position: 'relative' },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', backgroundColor: '#E1E1E1', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#666', fontWeight: 'bold' },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  infoText: { fontSize: 14, color: '#888', marginTop: 10 }
});