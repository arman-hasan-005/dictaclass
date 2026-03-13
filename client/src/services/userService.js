// FIX: This file was empty. All user/auth API calls are now centralized here.
import API from "./authService";

// Get the full profile (user doc + recent sessions)
export const getProfile = () => API.get("/auth/profile");

// Update display name, preferred level, preferred voice
export const updateProfile = (data) => API.put("/auth/profile", data);

// Get the current user from token
export const getMe = () => API.get("/auth/me");
