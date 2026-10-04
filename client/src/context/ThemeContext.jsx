import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const THEME_MODES = {
    SYSTEM: "system",
    LIGHT: "light",
    DARK: "dark",
};

export const ACCENT_PALETTES = {
    "#7c3aed": { name: "Royal Purple", color: "#7c3aed", endColor: "#4f46e5" },
    "#2563eb": { name: "Stream Blue", color: "#2563eb", endColor: "#4338ca" },
    "#059669": { name: "Emerald Green", color: "#059669", endColor: "#0f766e" },
    "#0891b2": { name: "Cyan Teal", color: "#0891b2", endColor: "#2563eb" },
    "#e11d48": { name: "Rose Ruby", color: "#e11d48", endColor: "#db2777" },
    "#d97706": { name: "Sunset Amber", color: "#d97706", endColor: "#ea580c" },
};

export const ThemeProvider = ({ children }) => {
    // Mode can be: 'system' | 'light' | 'dark' (default: 'system')
    const [themeMode, setThemeMode] = useState(() => {
        return localStorage.getItem("chatapp_theme_mode") || THEME_MODES.SYSTEM;
    });

    // Accent Color Palette
    const [accentColor, setAccentColor] = useState(() => {
        return localStorage.getItem("chatapp_accent") || "#7c3aed";
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

    // Sync themeMode to documentElement
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

    // Sync accentColor to CSS custom properties
    useEffect(() => {
        const root = document.documentElement;
        const palette = ACCENT_PALETTES[accentColor] || ACCENT_PALETTES["#7c3aed"];
        root.style.setProperty("--accent-primary", palette.color);
        root.style.setProperty("--accent-end", palette.endColor);
        root.style.setProperty(
            "--accent-bubble",
            `linear-gradient(135deg, ${palette.color}, ${palette.endColor})`
        );
        root.style.setProperty("--accent-shadow", `0 4px 14px ${palette.color}40`);
    }, [accentColor]);

    const changeThemeMode = (mode) => {
        setThemeMode(mode);
        localStorage.setItem("chatapp_theme_mode", mode);
    };

    const changeAccentColor = (color) => {
        setAccentColor(color);
        localStorage.setItem("chatapp_accent", color);
    };

    return (
        <ThemeContext.Provider
            value={{
                themeMode,
                resolvedTheme,
                isLight: resolvedTheme === "light",
                isDark: resolvedTheme === "dark",
                changeThemeMode,
                accentColor,
                changeAccentColor,
                ACCENT_PALETTES,
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
