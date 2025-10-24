// src/api/axios.ts
import axios from "axios"; // ✅ Removed unused 'AxiosHeaders' import

// 1. Get the API URL from Vite's environment variables
//    Provide a fallback for development or if the .env file is missing.
const API_URL =
  import.meta.env.VITE_API_URL || "https://unitrade-yrd9.onrender.com";

// 2. Create and configure the centralized axios instance
const api = axios.create({
  baseURL: API_URL,
  // withCredentials: true, // Uncomment this if your backend uses cookies/sessions for auth
});

// 3. (Optional but recommended) Add an interceptor to automatically attach the
//    auth token (if it exists) to every request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      // Axios ensures config.headers exists, so we just set the property.
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 4. Export the configured instance
export default api;