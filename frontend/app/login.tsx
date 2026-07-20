import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      // Replace Mac's IP address!
      const res = await axios.post('http://192.168.68.66:3000/login', {
        email,
        password,
      });
      const { token, user: {id} } =res.data;

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userId', id.toString());

      Alert.alert("Success", "You are logged in!");
      console.log("Token:", res.data.token);
      console.log("UserId:", res.data.id);

      router.replace('/(tabs)');
      // Later today, we will save this token so you stay logged in!
    } catch (error) {
      console.log(error);
      Alert.alert("Login Failed", "Check your credentials");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Riverside Connect</Text>
      
      <TextInput 
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      
      <TextInput 
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  logo: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, color: '#007AFF' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 10, marginBottom: 15 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});