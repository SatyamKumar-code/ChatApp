import { createContext, useEffect, useState } from "react";
import api from "../services/api";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check logged-in user
    const getCurrentUser = async () => {
        try {
            const response = await api.get("/auth/me");

            if (response.data.success) {
                setUser(response.data.user);
            }
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        };
    };

    useEffect(() => {
        getCurrentUser();
    }, []);

    // Register user
    const register = async (userData) => {
        const response = await api.post("/auth/register", userData);

        if (response.data.success === true) {
            setUser(response.data.user);
        }

        return response.data;

    }

    // Login user
    const login = async (loginData) => {

        const response = await api.post("/auth/login", loginData);

        if (response.data.success === true) {
            setUser(response.data.user);
        };

        return response.data;
    }

    // Logout user
    const logout = async () => {
        try {
            await api.post("/auth/logout");
        }finally {
            setUser(null);
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