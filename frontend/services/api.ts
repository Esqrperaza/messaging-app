import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HOST_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.68.66:3000';

const api = axios.create({
  baseURL: HOST_URL,
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;