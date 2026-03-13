import axios from "axios";

// FIX: Was hardcoded to "http://localhost:5000/api" — breaks in production.
//      Now reads from VITE_API_URL environment variable.
//      Create a .env file at client root with: VITE_API_URL=http://localhost:5000/api
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Automatically attach JWT Bearer token from localStorage to every request
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem("dictaclass_user") || "null");
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Global response interceptor — handle 401 (token expired) gracefully
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear local storage
      localStorage.removeItem("dictaclass_user");
      // Don't force redirect here; ProtectedRoute in App.jsx will handle it
    }
    return Promise.reject(error);
  }
);

export default API;
