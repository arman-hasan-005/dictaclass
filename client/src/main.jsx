// FIX: Removed <StrictMode> wrapper.
// React StrictMode intentionally double-invokes effects in development,
// which caused Results.jsx to POST the session twice on page load,
// doubling XP and badge awards during testing.
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          borderRadius: "10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        },
        success: { iconTheme: { primary: "#059669", secondary: "#fff" } },
        error:   { iconTheme: { primary: "#DC2626", secondary: "#fff" } },
      }}
    />
    <App />
  </>
);
