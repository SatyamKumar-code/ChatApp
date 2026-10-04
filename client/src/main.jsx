import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx'
import AuthProvider from './context/AuthContext.jsx'
import ChatProvider from './context/ChatContext.jsx'
import CallProvider from './context/CallContext.jsx'
import ThemeProvider from './context/ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <App />
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
