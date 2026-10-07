import { createContext, useEffect, useState } from "react";
import api from "../services/api";
import {
    unsubscribeFromPush,
    syncPushSubscriptionIfGranted,
} from "../services/pushNotificationService";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem("chatapp_cached_user");
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [loading, setLoading] = useState(() => {
        // If we already have a cached user, we can set loading to false faster
        const hasCached = localStorage.getItem("chatapp_cached_user");
        return !hasCached;
    });

    // Check logged-in user
    const getCurrentUser = async () => {
        // If device is offline, do not clear user; keep cached session
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            setLoading(false);
            return;
        }

        try {
            const response = await api.get("/auth/me");

            if (response.data.success) {
                setUser(response.data.user);
                try {
                    localStorage.setItem("chatapp_cached_user", JSON.stringify(response.data.user));
                } catch (e) {}
                syncPushSubscriptionIfGranted().catch(() => {});
            }
        } catch (error) {
            // ONLY log out / clear user if server explicitly returned 401 unauthenticated.
            // If offline, network disconnected, or timeout, KEEP cached user!
            if (error.response?.status === 401) {
                setUser(null);
                try {
                    localStorage.removeItem("chatapp_cached_user");
                } catch (e) {}
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getCurrentUser();

        // When device comes back online, re-verify session with server
        const handleOnline = () => {
            getCurrentUser();
        };

        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, []);

    // Register user
    const register = async (userData) => {
        const response = await api.post("/auth/register", userData);

        if (response.data.success === true) {
            setUser(response.data.user);
            try {
                localStorage.setItem("chatapp_cached_user", JSON.stringify(response.data.user));
            } catch (e) {}
        }

        return response.data;
    };

    // Login user
    const login = async (loginData) => {
        const response = await api.post("/auth/login", loginData);

        if (response.data.success === true) {
            setUser(response.data.user);
            try {
                localStorage.setItem("chatapp_cached_user", JSON.stringify(response.data.user));
            } catch (e) {}
        }

        return response.data;
    };

    // Logout user
    const logout = async () => {
        try {
            await unsubscribeFromPush().catch(() => {});
        } catch (e) {}

        try {
            await api.post("/auth/logout");
        } finally {
            setUser(null);
            try {
                localStorage.removeItem("chatapp_cached_user");
                localStorage.removeItem("chatapp_cached_conversations");
                sessionStorage.removeItem("chatapp_push_prompt_dismissed");
            } catch (e) {}
        }
    };

    // Update user profile (name, about, profilePicture)
    const updateProfile = async (profileData) => {
        const response = await api.put("/auth/profile", profileData);
        if (response.data.success && response.data.user) {
            setUser((prev) => ({
                ...(prev || {}),
                ...response.data.user,
            }));
        }
        return response.data;
    };

    const value = {
        user,
        loading,
        register,
        login,
        logout,
        updateProfile,
        getCurrentUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;