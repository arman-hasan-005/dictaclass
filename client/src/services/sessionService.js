// FIX: This file was empty. All session-related API calls are now centralized here
//      instead of being scattered inside page components.
import API from "./authService";

// Submit a completed dictation session
export const submitSession = (payload) => API.post("/sessions", payload);

// Fetch the user's last 20 sessions
export const getSessionHistory = () => API.get("/sessions/history");

// Fetch aggregated stats (total sessions, average score, best score, level breakdown)
export const getStats = () => API.get("/sessions/stats");
