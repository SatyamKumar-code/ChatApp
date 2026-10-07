import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useTheme, THEME_MODES } from "../../context/ThemeContext";
import Modal from "../common/Modal";
import ProfilePhotoUpload from "./ProfilePhotoUpload";
import { playMessageSound } from "../../utils/callSounds";
import { usePwa } from "../../context/PwaContext";
import {
    isFileSystemAccessSupported,
    promptSelectChatAppDirectory,
    getStoredDirectoryHandle,
    clearStoredDirectoryHandle,
    MOBILE_DEFAULT_ROOT,
    PC_DEFAULT_ROOT,
    isMobileDevice,
} from "../../services/fileSystemStorage";
import { getLocalFileStats } from "../../services/localFileRegistry";
import api from "../../services/api";
import {
    isPushSupported,
    getNotificationPermission,
    getActiveSubscription,
    subscribeToPush,
    unsubscribeFromPush,
} from "../../services/pushNotificationService";

export const SettingsModal = ({ isOpen, onClose }) => {
    const { user, updateProfile, logout } = useContext(AuthContext);
    const {
        themeMode,
        changeThemeMode,
        resolvedTheme,
        accentColor,
        changeAccentColor,
        ACCENT_PALETTES,
    } = useTheme();

    // Active tab
    const [activeTab, setActiveTab] = useState("profile");

    // Profile form state
    const [name, setName] = useState(user?.name || "");
    const [about, setAbout] = useState(user?.about || "Hey there! I am using ChatApp.");
    const [profilePicture, setProfilePicture] = useState(user?.profilePicture || "");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Preferences state (stored in localStorage)
    const [soundEnabled, setSoundEnabled] = useState(() => {
        return localStorage.getItem("chatapp_sound") !== "false";
    });
    const [readReceipts, setReadReceipts] = useState(() => {
        return localStorage.getItem("chatapp_receipts") !== "false";
    });
    const [onlineVisible, setOnlineVisible] = useState(() => {
        return localStorage.getItem("chatapp_online_visible") !== "false";
    });

    const { isInstalled, canPromptDirectly, triggerInstall, openInstallModal, os, deviceLabel } = usePwa();

    // Local Storage & File System Access state
    const [directoryHandle, setDirectoryHandle] = useState(null);
    const [storageStats, setStorageStats] = useState(null);
    const [storageStatusMsg, setStorageStatusMsg] = useState("");
    const fsSupported = isFileSystemAccessSupported();

    // Push notification states
    const [pushSupported, setPushSupported] = useState(true);
    const [pushPermission, setPushPermission] = useState("default");
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    const checkPushState = React.useCallback(async () => {
        const supported = isPushSupported();
        setPushSupported(supported);
        if (!supported) return;

        const perm = getNotificationPermission();
        setPushPermission(perm);

        const sub = await getActiveSubscription();
        setPushSubscribed(!!sub);

        try {
            const res = await api.get("/push/status");
            if (res.data?.success && res.data.isSubscribed && sub) {
                setPushSubscribed(true);
            }
        } catch (e) {}
    }, []);

    React.useEffect(() => {
        if (isOpen && activeTab === "notifications") {
            checkPushState();
        }
    }, [isOpen, activeTab, checkPushState]);

    const handleEnablePush = async () => {
        try {
            setPushLoading(true);
            await subscribeToPush();
            await checkPushState();
        } catch (err) {
            console.error("Enable push error:", err);
            setPushPermission(getNotificationPermission());
        } finally {
            setPushLoading(false);
        }
    };

    const handleDisablePush = async () => {
        try {
            setPushLoading(true);
            await unsubscribeFromPush();
            await checkPushState();
        } catch (err) {
            console.error("Disable push error:", err);
        } finally {
            setPushLoading(false);
        }
    };

    React.useEffect(() => {
        if (isOpen && activeTab === "storage") {
            getStoredDirectoryHandle().then((handle) => setDirectoryHandle(handle));
            getLocalFileStats().then((stats) => setStorageStats(stats));
        }
    }, [isOpen, activeTab]);

    const handleSelectDirectory = async () => {
        try {
            setStorageStatusMsg("");
            const handle = await promptSelectChatAppDirectory();
            if (handle) {
                setDirectoryHandle(handle);
                setStorageStatusMsg(`Connected storage folder: "${handle.name}"`);
            }
        } catch (err) {
            console.error("Select directory error:", err);
            setStorageStatusMsg("Failed to link folder: " + (err.message || ""));
        }
    };

    const handleDisconnectDirectory = async () => {
        await clearStoredDirectoryHandle();
        setDirectoryHandle(null);
        setStorageStatusMsg("Reverted to default browser Downloads fallback.");
    };

    // When modal opens or user changes, sync form
    React.useEffect(() => {
        if (user) {
            setName(user.name || "");
            setAbout(user.about || "Hey there! I am using ChatApp.");
            setProfilePicture(user.profilePicture || "");
            setSaveSuccess(false);
            setErrorMessage("");
        }
        if (isInstalled && activeTab === "downloadApp") {
            setActiveTab("profile");
        }
    }, [user, isOpen, isInstalled]);

    // Handle profile update
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage("Please enter your name.");
            return;
        }

        try {
            setSaving(true);
            setErrorMessage("");
            setSaveSuccess(false);

            await updateProfile({
                name: name.trim(),
                about: about.trim(),
                profilePicture: profilePicture || "",
            });

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Save profile error:", error);
            setErrorMessage(
                error.response?.data?.message || "Failed to update profile."
            );
        } finally {
            setSaving(false);
        }
    };

    // Save preferences
    const handleAccentChange = (color) => {
        changeAccentColor(color);
    };

    const handleSoundToggle = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        localStorage.setItem("chatapp_sound", String(next));
    };

    const handleReceiptsToggle = () => {
        const next = !readReceipts;
        setReadReceipts(next);
        localStorage.setItem("chatapp_receipts", String(next));
    };

    const handleOnlineVisibleToggle = () => {
        const next = !onlineVisible;
        setOnlineVisible(next);
        localStorage.setItem("chatapp_online_visible", String(next));
    };

    const aboutPresets = [
        "Available",
        "Busy",
        "At work",
        "In a meeting",
        "Battery about to die",
        "Can't talk, ChatApp only",
    ];

    const accentOptions = [
        { name: "Royal Purple", color: "#7c3aed" },
        { name: "Stream Blue", color: "#2563eb" },
        { name: "Emerald Green", color: "#059669" },
        { name: "Cyan Teal", color: "#0891b2" },
        { name: "Rose Ruby", color: "#e11d48" },
        { name: "Sunset Amber", color: "#d97706" },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Settings & Preferences"
            subtitle="Manage your profile, theme, and chat preferences"
            maxWidth="max-w-2xl"
        >
            <div className="flex flex-col md:flex-row gap-6">
                {/* Vertical Tabs Sidebar */}
                <div className="flex md:flex-col gap-1 overflow-x-auto md:w-44 shrink-0 pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-white/10 pr-0 md:pr-4">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === "profile"
                                ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                        Profile
                    </button>

                    <button
                        onClick={() => setActiveTab("appearance")}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === "appearance"
                                ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21a4 4 0 01-4-4 4 4 0 014-4c.48 0 .93.09 1.34.25A4.004 4.004 0 0115 11h2a2 2 0 012 2v1a2 2 0 01-2 2h-1a2 2 0 00-2 2v2a2 2 0 01-2 2h-2z"
                            />
                        </svg>
                        Appearance
                    </button>

                    <button
                        onClick={() => setActiveTab("privacy")}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === "privacy"
                                ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                        </svg>
                        Privacy
                    </button>

                    <button
                        onClick={() => setActiveTab("notifications")}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === "notifications"
                                ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                            />
                        </svg>
                        Notifications
                    </button>

                    <button
                        onClick={() => setActiveTab("account")}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === "account"
                                ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        Account
                    </button>

                    {/* Local Storage & Files Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("storage")}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${activeTab === "storage"
                                ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 shrink-0 text-cyan-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                        </svg>
                        Storage & Files
                    </button>

                    {/* App Download Tab */}
                    {/* App Download Tab - strictly hidden when user is already using PWA */}
                    {!isInstalled && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("downloadApp")}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${activeTab === "downloadApp"
                                    ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4 shrink-0 text-emerald-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                                Install App
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full border bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {deviceLabel}
                            </span>
                        </button>
                    )}
                </div>

                {/* Tab Content Panel */}
                <div className="flex-1 min-w-0">
                    {/* ===== 1. PROFILE TAB ===== */}
                    {activeTab === "profile" && (
                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            {/* Photo Upload Section */}
                            <div className="bg-[#181830] p-4 rounded-xl border border-white/5">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                                    Profile Picture
                                </h4>
                                <ProfilePhotoUpload
                                    currentPhoto={profilePicture}
                                    name={name}
                                    onPhotoSelected={(base64) => setProfilePicture(base64)}
                                    onPhotoRemoved={() => setProfilePicture("")}
                                />
                            </div>

                            {/* Name Input */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                                    Full Name <span className="text-purple-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    maxLength={50}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#181830] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                    required
                                />
                            </div>

                            {/* Phone (Read Only) */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                                    Phone Number
                                </label>
                                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#161628] border border-white/5 text-zinc-400 text-sm">
                                    <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                                        +91
                                    </span>
                                    <span>{user?.phone || "Not set"}</span>
                                    <span className="ml-auto text-[11px] text-zinc-500">
                                        Verified
                                    </span>
                                </div>
                            </div>

                            {/* About / Bio Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-zinc-300">
                                        About / Status
                                    </label>
                                    <span className="text-[11px] text-zinc-500">
                                        {about.length}/150
                                    </span>
                                </div>
                                <textarea
                                    value={about}
                                    onChange={(e) => setAbout(e.target.value)}
                                    placeholder="Tell others what you're up to..."
                                    maxLength={150}
                                    rows={2}
                                    className="w-full px-3.5 py-2 rounded-xl bg-[#181830] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                                />

                                {/* Status Presets */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {aboutPresets.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setAbout(preset)}
                                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 transition-colors"
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Messages */}
                            {errorMessage && (
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                                    {errorMessage}
                                </div>
                            )}

                            {saveSuccess && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-4 h-4 text-emerald-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Profile updated successfully!
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
                                >
                                    {saving && (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {saving ? "Saving Changes..." : "Save Profile"}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ===== 2. APPEARANCE TAB ===== */}
                    {activeTab === "appearance" && (
                        <div className="space-y-6">
                            {/* Theme Mode: System, Dark, Light */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        Interface Theme
                                    </h4>
                                    <span className="text-[11px] text-purple-400 font-medium">
                                        {themeMode === THEME_MODES.SYSTEM
                                            ? `System default (${resolvedTheme})`
                                            : themeMode === THEME_MODES.LIGHT
                                                ? "Light mode"
                                                : "Dark mode"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {/* System Mode (Default) */}
                                    <button
                                        type="button"
                                        onClick={() => changeThemeMode(THEME_MODES.SYSTEM)}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${themeMode === THEME_MODES.SYSTEM
                                                ? "bg-purple-600/15 border-purple-500 shadow-md ring-1 ring-purple-500 text-purple-300 font-semibold"
                                                : "bg-[#181830] border-white/5 hover:border-white/20 text-zinc-300"
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-medium">System</p>
                                            <p className="text-[10px] text-zinc-400">Default auto</p>
                                        </div>
                                    </button>

                                    {/* Dark Mode */}
                                    <button
                                        type="button"
                                        onClick={() => changeThemeMode(THEME_MODES.DARK)}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${themeMode === THEME_MODES.DARK
                                                ? "bg-purple-600/15 border-purple-500 shadow-md ring-1 ring-purple-500 text-purple-300 font-semibold"
                                                : "bg-[#181830] border-white/5 hover:border-white/20 text-zinc-300"
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                            </svg>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-medium">Dark</p>
                                            <p className="text-[10px] text-zinc-400">Always dark</p>
                                        </div>
                                    </button>

                                    {/* Light Mode */}
                                    <button
                                        type="button"
                                        onClick={() => changeThemeMode(THEME_MODES.LIGHT)}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${themeMode === THEME_MODES.LIGHT
                                                ? "bg-purple-600/15 border-purple-500 shadow-md ring-1 ring-purple-500 text-purple-300 font-semibold"
                                                : "bg-[#181830] border-white/5 hover:border-white/20 text-zinc-300"
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-medium">Light</p>
                                            <p className="text-[10px] text-zinc-400">Always light</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                                    Accent Color Theme
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    {accentOptions.map((item) => {
                                        const isSelected = accentColor === item.color;
                                        return (
                                            <button
                                                key={item.color}
                                                type="button"
                                                onClick={() => handleAccentChange(item.color)}
                                                style={
                                                    isSelected
                                                        ? {
                                                            borderColor: item.color,
                                                            boxShadow: `0 0 0 1.5px ${item.color}, 0 4px 12px ${item.color}35`,
                                                        }
                                                        : undefined
                                                }
                                                className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left ${isSelected
                                                        ? "bg-white/10"
                                                        : "bg-[#181830] border-white/5 hover:border-white/20"
                                                    }`}
                                            >
                                                <div
                                                    className="w-5 h-5 rounded-full shrink-0 shadow-sm flex items-center justify-center text-white text-[10px] font-bold"
                                                    style={{ backgroundColor: item.color }}
                                                >
                                                    {isSelected && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                                    {item.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bubble Preview */}
                            <div className="bg-[#181830] p-4 rounded-xl border border-white/5 space-y-2">
                                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                                    Chat Bubble Preview
                                </span>
                                <div className="flex flex-col gap-2 pt-1">
                                    <div className="self-start max-w-[80%] px-3.5 py-2 rounded-2xl rounded-bl-sm bg-[#1e1e35] text-xs text-zinc-200 border border-white/5">
                                        Hey! How does the new theme look?
                                    </div>
                                    <div
                                        className="chat-bubble-outgoing self-end max-w-[80%] px-3.5 py-2 rounded-2xl rounded-br-sm text-xs font-medium shadow-md transition-all duration-300"
                                        style={{
                                            background: `linear-gradient(135deg, ${ACCENT_PALETTES?.[accentColor]?.color || accentColor
                                                }, ${ACCENT_PALETTES?.[accentColor]?.endColor || "#4f46e5"
                                                })`,
                                            boxShadow: `0 4px 14px ${accentColor}40`,
                                            color: "#ffffff",
                                        }}
                                    >
                                        It looks stunning! Exactly like the Figma UI Kit 🔥
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== 3. PRIVACY TAB ===== */}
                    {activeTab === "privacy" && (
                        <div className="space-y-4">
                            <div className="bg-[#181830] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-medium text-white">
                                        Online Status Indicator
                                    </h4>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Let others see when you are currently online on ChatApp
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOnlineVisibleToggle}
                                    className={`w-11 h-6 rounded-full transition-colors relative ${onlineVisible ? "bg-purple-600" : "bg-zinc-700"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${onlineVisible ? "translate-x-5" : ""
                                            }`}
                                    />
                                </button>
                            </div>

                            <div className="bg-[#181830] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-medium text-white">
                                        Read Receipts (Blue Ticks)
                                    </h4>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Show when you have read messages and see when others read yours
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleReceiptsToggle}
                                    className={`w-11 h-6 rounded-full transition-colors relative ${readReceipts ? "bg-purple-600" : "bg-zinc-700"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${readReceipts ? "translate-x-5" : ""
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== 4. NOTIFICATIONS TAB ===== */}
                    {activeTab === "notifications" && (
                        <div className="space-y-4">
                            {/* Desktop & Mobile Push Notifications */}
                            <div className="bg-[#181830] p-4.5 rounded-2xl border border-white/5 space-y-3.5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-5 h-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-medium text-white">
                                                    Desktop & Mobile Notifications
                                                </h4>
                                                {pushPermission === "denied" ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-medium">
                                                        Blocked
                                                    </span>
                                                ) : pushSubscribed ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium">
                                                        Off
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-0.5">
                                                Receive alerts for new messages and calls even when ChatApp is closed
                                            </p>
                                        </div>
                                    </div>

                                    {/* Clean Toggle Switch */}
                                    <button
                                        type="button"
                                        onClick={pushSubscribed ? handleDisablePush : handleEnablePush}
                                        disabled={pushLoading || pushPermission === "denied" || !pushSupported}
                                        aria-label="Toggle Push Notifications"
                                        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                            pushSubscribed ? "bg-purple-600" : "bg-zinc-700"
                                        }`}
                                    >
                                        {pushLoading ? (
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                </svg>
                                            </span>
                                        ) : (
                                            <span
                                                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                                    pushSubscribed ? "translate-x-5" : ""
                                                }`}
                                            />
                                        )}
                                    </button>
                                </div>

                                {/* Notice only when permission is blocked in browser */}
                                {pushPermission === "denied" && (
                                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>Notifications are blocked. Click the lock/site settings icon in your browser address bar to allow.</span>
                                    </div>
                                )}
                            </div>

                            {/* In-App Message & Call Sounds */}
                            <div className="bg-[#181830] p-4.5 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-5 h-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-white">
                                            Message & Call Sounds
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            Play audio chimes and ringtones when new messages or calls arrive
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSoundToggle}
                                    aria-label="Toggle Sound"
                                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                                        soundEnabled ? "bg-purple-600" : "bg-zinc-700"
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                            soundEnabled ? "translate-x-5" : ""
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== 5. ACCOUNT TAB ===== */}
                    {activeTab === "account" && (
                        <div className="space-y-4">
                            <div className="bg-[#181830] p-4 rounded-xl border border-white/5 space-y-3">
                                <div>
                                    <span className="text-xs text-zinc-400">User ID</span>
                                    <div className="text-xs font-mono text-zinc-200 mt-0.5">
                                        {user?._id || user?.id || "N/A"}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-400">Phone Number</span>
                                    <div className="text-sm font-medium text-white mt-0.5">
                                        {user?.phone}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={logout}
                                    className="settings-logout-btn w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                        />
                                    </svg>
                                    Log Out of ChatApp
                                </button>
                            </div>
                        </div>
                    )}                    {/* ===== 5B. STORAGE & FILES TAB ===== */}
                    {activeTab === "storage" && (() => {
                        const isMobile =
                            os === "android" ||
                            os === "ios" ||
                            isMobileDevice();

                        const folderDisplayName = isMobile
                            ? "Internal Storage • ChatApp"
                            : (directoryHandle ? directoryHandle.name : "Downloads • ChatApp");

                        const totalMb = storageStats
                            ? (storageStats.totalBytes / (1024 * 1024)).toFixed(1)
                            : "0.0";

                        const totalImages = (storageStats?.send?.image || 0) + (storageStats?.received?.image || 0);
                        const totalVideos = (storageStats?.send?.video || 0) + (storageStats?.received?.video || 0);
                        const totalDocs = (storageStats?.send?.document || 0) + (storageStats?.received?.document || 0);

                        return (
                            <div className="space-y-4">
                                {/* Media Storage Location Card */}
                                <div className="bg-[#181830] p-4.5 rounded-2xl border border-white/5 space-y-3.5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                                    />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white">
                                                    Media Storage Location
                                                </h4>
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                    Where sent and received photos, videos & docs are saved locally
                                                </p>
                                            </div>
                                        </div>

                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Active
                                        </span>
                                    </div>

                                    {/* Location Pill */}
                                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-base shrink-0">📁</span>
                                            <span className="text-xs font-mono text-cyan-300 truncate font-medium">
                                                {folderDisplayName}
                                            </span>
                                        </div>

                                        {!isMobile && fsSupported && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                {directoryHandle ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={handleSelectDirectory}
                                                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium border border-white/10 transition-all cursor-pointer"
                                                        >
                                                            Change
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDisconnectDirectory}
                                                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition-all cursor-pointer"
                                                        >
                                                            Reset
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleSelectDirectory}
                                                        className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/30 transition-all cursor-pointer"
                                                    >
                                                        Custom Folder
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {storageStatusMsg && (
                                        <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between">
                                            <span>{storageStatusMsg}</span>
                                            <button
                                                onClick={() => setStorageStatusMsg("")}
                                                className="text-cyan-400 hover:text-white text-xs ml-2 cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Storage Breakdown Card */}
                                <div className="bg-[#181830] p-4.5 rounded-2xl border border-white/5 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                                                    />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white">
                                                    Local Media Usage
                                                </h4>
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                    Offline cached files stored on this device
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-bold text-white">{totalMb} MB</div>
                                            <div className="text-[11px] text-zinc-400 font-medium">
                                                {storageStats?.totalFiles || 0} files total
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clean Category Cards */}
                                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                            <span className="text-lg">🖼️</span>
                                            <div className="text-xs font-semibold text-white mt-1">
                                                {totalImages}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 mt-0.5">Photos</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                            <span className="text-lg">🎥</span>
                                            <div className="text-xs font-semibold text-white mt-1">
                                                {totalVideos}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 mt-0.5">Videos</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                            <span className="text-lg">📄</span>
                                            <div className="text-xs font-semibold text-white mt-1">
                                                {totalDocs}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 mt-0.5">Documents</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ===== 6. INSTALL / DOWNLOAD APP TAB (Only if NOT installed) ===== */}
                    {!isInstalled && activeTab === "downloadApp" && (
                        <div className="py-2">
                            <div className="p-5 rounded-2xl bg-[#181830] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 p-0.5 border border-purple-500/30 flex-shrink-0 shadow-md">
                                        <img
                                            src="/pwa-512x512.png"
                                            alt="ChatApp"
                                            className="w-full h-full object-cover rounded-[10px]"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-white">
                                            ChatApp
                                        </h4>
                                        <span className="text-xs text-purple-300 font-medium">
                                            {deviceLabel}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={canPromptDirectly ? triggerInstall : openInstallModal}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                    </svg>
                                    Install for {deviceLabel}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default SettingsModal;
