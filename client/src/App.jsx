import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import ChatHome from "./pages/ChatHome";
import OfflineStatusIndicator from "./components/common/OfflineStatusIndicator";
import MobileAppDownloadBanner from "./components/common/MobileAppDownloadBanner";

function App() {
  return (
    <BrowserRouter>
      {/* Visual Offline Mode & Reconnection Indicator */}
      <OfflineStatusIndicator />

      {/* Mobile Download/Install Banner: Strictly visible only on Android & iOS mobile, hidden on Desktop */}
      <MobileAppDownloadBanner />

      <Routes>
        {/* Guest-only routes: If already logged in, redirect to "/" */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatHome />
            </ProtectedRoute>
          }
        />

        {/* Wildcard redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
