import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const THEME_MODES = {
    SYSTEM: "system",
    LIGHT: "light",
    DARK: "dark",
};

export const ThemeProvider = ({ children }) => {
    // Mode can be: 'system' | 'light' | 'dark' (default: 'system')
    const [themeMode, setThemeMode] = useState(() => {
        return localStorage.getItem("chatapp_theme_mode") || THEME_MODES.SYSTEM;
    });

    // Resolved actual theme: 'light' or 'dark'
    const [resolvedTheme, setResolvedTheme] = useState(() => {
        const saved = localStorage.getItem("chatapp_theme_mode") || THEME_MODES.SYSTEM;
        if (saved === THEME_MODES.LIGHT) return "light";
        if (saved === THEME_MODES.DARK) return "dark";
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");

        const applyTheme = () => {
            let actual = "dark";
            if (themeMode === THEME_MODES.LIGHT) {
                actual = "light";
            } else if (themeMode === THEME_MODES.DARK) {
                actual = "dark";
            } else {
                // system default
                actual = mediaQuery.matches ? "light" : "dark";
            }

            setResolvedTheme(actual);

            const root = document.documentElement;
            if (actual === "light") {
                root.classList.add("light");
                root.classList.remove("dark");
                root.setAttribute("data-theme", "light");
            } else {
                root.classList.add("dark");
                root.classList.remove("light");
                root.setAttribute("data-theme", "dark");
            }
        };

        applyTheme();

        const handleMediaChange = () => {
            if (themeMode === THEME_MODES.SYSTEM) {
                applyTheme();
            }
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener("change", handleMediaChange);
            return () => mediaQuery.removeEventListener("change", handleMediaChange);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleMediaChange);
            return () => mediaQuery.removeListener(handleMediaChange);
        }
    }, [themeMode]);

    const changeThemeMode = (mode) => {
        setThemeMode(mode);
        localStorage.setItem("chatapp_theme_mode", mode);
    };

    return (
        <ThemeContext.Provider
            value={{
                themeMode,
                resolvedTheme,
                isLight: resolvedTheme === "light",
                isDark: resolvedTheme === "dark",
                changeThemeMode,
                THEME_MODES,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

export default ThemeProvider;
