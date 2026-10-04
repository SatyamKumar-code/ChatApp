import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx'
import AlertProvider from './context/AlertContext.jsx'
import AuthProvider from './context/AuthContext.jsx'
import ChatProvider from './context/ChatContext.jsx'
import CallProvider from './context/CallContext.jsx'
import ThemeProvider from './context/ThemeContext.jsx'
import { PwaProvider } from './context/PwaContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PwaProvider>
      <AlertProvider>
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <CallProvider>
                <App />
              </CallProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </AlertProvider>
    </PwaProvider>
  </StrictMode>
)

// Register Service Worker for offline app loading
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.warn("Service Worker registration failed:", err);
      });
  });
}
