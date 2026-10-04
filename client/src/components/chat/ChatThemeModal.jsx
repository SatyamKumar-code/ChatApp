import React, { useState, useEffect, useRef } from "react";
import Modal from "../common/Modal";

export const CHAT_THEMES = [
    {
        id: "default",
        name: "Dark Space",
        preview: "from-[#111124] to-[#0c0c1a]",
        background: "bg-[#0c0c1a]",
        style: { background: "#0c0c1a" },
    },
    {
        id: "nebula-purple",
        name: "Neon Nebula",
        preview: "from-purple-900 via-indigo-950 to-[#0a0a16]",
        background: "bg-gradient-to-b from-purple-950/70 via-indigo-950/40 to-[#0a0a16]",
        style: {
            background: "radial-gradient(circle at 50% 10%, rgba(124, 58, 237, 0.28) 0%, rgba(12, 12, 26, 0.96) 70%, #0a0a14 100%)",
        },
    },
    {
        id: "cyber-emerald",
        name: "Cyber Emerald",
        preview: "from-emerald-900 via-teal-950 to-[#071310]",
        background: "bg-gradient-to-b from-emerald-950/70 via-teal-950/40 to-[#071310]",
        style: {
            background: "radial-gradient(circle at 50% 10%, rgba(16, 185, 129, 0.22) 0%, rgba(7, 19, 16, 0.96) 70%, #050d0b 100%)",
        },
    },
    {
        id: "sunset-glow",
        name: "Sunset Glow",
        preview: "from-rose-900 via-amber-950 to-[#120710]",
        background: "bg-gradient-to-b from-rose-950/70 via-amber-950/40 to-[#120710]",
        style: {
            background: "radial-gradient(circle at 50% 10%, rgba(244, 63, 94, 0.24) 0%, rgba(18, 7, 16, 0.96) 70%, #0c040b 100%)",
        },
    },
    {
        id: "deep-ocean",
        name: "Deep Ocean",
        preview: "from-blue-900 via-cyan-950 to-[#05111b]",
        background: "bg-gradient-to-b from-blue-950/70 via-cyan-950/40 to-[#05111b]",
        style: {
            background: "radial-gradient(circle at 50% 10%, rgba(14, 165, 233, 0.24) 0%, rgba(5, 17, 27, 0.96) 70%, #030a10 100%)",
        },
    },
    {
        id: "minimal-carbon",
        name: "Minimal Carbon",
        preview: "from-zinc-800 to-zinc-950",
        background: "bg-zinc-950",
        style: {
            background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
        },
    },
    {
        id: "amethyst-violet",
        name: "Amethyst Royal",
        preview: "from-fuchsia-900 via-purple-950 to-[#0f071a]",
        background: "bg-gradient-to-b from-fuchsia-950/70 via-purple-950/40 to-[#0f071a]",
        style: {
            background: "radial-gradient(circle at 50% 10%, rgba(192, 38, 211, 0.24) 0%, rgba(15, 7, 26, 0.96) 70%, #090410 100%)",
        },
    },
];

export const PRESET_WALLPAPERS = [
    {
        id: "wall-stars",
        name: "Cosmic Stars",
        url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: "wall-aurora",
        name: "Nordic Aurora",
        url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: "wall-cybercity",
        name: "Neon Metropolis",
        url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: "wall-mountain",
        name: "Dark Mountain",
        url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    },
];

export const ChatThemeModal = ({
    isOpen,
    onClose,
    currentThemeId = "default",
    onSelectTheme,
    customWallpaper = "",
    onSetCustomWallpaper,
    wallpaperOpacity = 0.45,
    onSetWallpaperOpacity,
}) => {
    const [selectedId, setSelectedId] = useState(currentThemeId);
    const [activeTab, setActiveTab] = useState("wallpapers"); // "wallpapers" | "themes"
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef(null);

    useEffect(() => {
        setSelectedId(currentThemeId);
    }, [currentThemeId, isOpen]);

    const handleApplyTheme = (themeId) => {
        setSelectedId(themeId);
        onSelectTheme?.(themeId);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setUploadError("Please select a valid image file (PNG, JPG, WebP)");
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            setUploadError("Image size must be less than 8MB");
            return;
        }

        setUploadError("");
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            onSetCustomWallpaper?.(base64);
        };
        reader.onerror = () => {
            setUploadError("Failed to read image file");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Chat Wallpaper & Theme"
            subtitle="Choose a color theme or add a custom background wallpaper image"
            maxWidth="max-w-lg"
        >
            <div className="space-y-4">
                {/* Tab Switcher: Wallpapers vs Atmosphere Themes */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141426] border border-white/5 text-xs select-none">
                    <button
                        type="button"
                        onClick={() => setActiveTab("wallpapers")}
                        className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeTab === "wallpapers"
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <span>🖼️</span>
                        <span>Wallpaper Image</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("themes")}
                        className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeTab === "themes"
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <span>🎨</span>
                        <span>Color Theme</span>
                    </button>
                </div>

                {uploadError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                        {uploadError}
                    </div>
                )}

                {activeTab === "wallpapers" ? (
                    <div className="space-y-4">
                        {/* 1. Custom Image Upload Box */}
                        <div className="p-4 rounded-2xl bg-[#131325] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                                    {customWallpaper ? (
                                        <img
                                            src={customWallpaper}
                                            alt="Custom wallpaper"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        "📷"
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xs font-semibold text-white">
                                        Custom Photo / Wallpaper
                                    </h4>
                                    <p className="text-[11px] text-zinc-400">
                                        {customWallpaper
                                            ? "Custom image active"
                                            : "Upload any photo from your device"}
                                    </p>
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                className="hidden"
                            />

                            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all shadow-md shadow-purple-600/30 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                        />
                                    </svg>
                                    <span>Upload Image</span>
                                </button>

                                {customWallpaper && (
                                    <button
                                        type="button"
                                        onClick={() => onSetCustomWallpaper?.("")}
                                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 text-xs font-medium transition-all cursor-pointer"
                                        title="Remove custom wallpaper"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Wallpaper Opacity / Dimness Slider (if wallpaper active) */}
                        {customWallpaper && (
                            <div className="p-3 rounded-xl bg-[#131325] border border-white/10 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-300 font-medium">Wallpaper Opacity</span>
                                    <span className="text-purple-400 font-mono">
                                        {Math.round(wallpaperOpacity * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.9"
                                    step="0.05"
                                    value={wallpaperOpacity}
                                    onChange={(e) => onSetWallpaperOpacity?.(parseFloat(e.target.value))}
                                    className="w-full accent-purple-500 cursor-pointer"
                                />
                                <p className="text-[10px] text-zinc-500">
                                    Adjust opacity so messages remain easy to read.
                                </p>
                            </div>
                        )}

                        {/* Preset Scenic Wallpapers */}
                        <div>
                            <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
                                Featured Wallpapers
                            </h5>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {PRESET_WALLPAPERS.map((wp) => {
                                    const isSelected = customWallpaper === wp.url;
                                    return (
                                        <button
                                            key={wp.id}
                                            type="button"
                                            onClick={() => onSetCustomWallpaper?.(wp.url)}
                                            className={`group relative rounded-xl overflow-hidden border aspect-video transition-all cursor-pointer ${
                                                isSelected
                                                    ? "border-purple-500 ring-2 ring-purple-500/50 scale-[1.02]"
                                                    : "border-white/10 hover:border-white/30"
                                            }`}
                                        >
                                            <img
                                                src={wp.url}
                                                alt={wp.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                                                <span className="text-[10px] text-white font-medium truncate">
                                                    {wp.name}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] shadow-md">
                                                    ✓
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Color Themes Grid */
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto p-1">
                        {CHAT_THEMES.map((theme) => {
                            const isSelected = selectedId === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => handleApplyTheme(theme.id)}
                                    className={`group relative flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                                        isSelected
                                            ? "border-purple-500 bg-purple-600/15 shadow-lg shadow-purple-600/20 ring-2 ring-purple-500/30"
                                            : "border-white/10 bg-[#141426] hover:border-white/20 hover:bg-white/5"
                                    }`}
                                >
                                    {/* Theme Preview Box */}
                                    <div
                                        className={`w-full h-16 rounded-xl bg-gradient-to-b ${theme.preview} flex items-center justify-center relative overflow-hidden border border-white/10 shadow-inner mb-2`}
                                        style={theme.style}
                                    >
                                        {/* Mock Chat Bubbles */}
                                        <div className="space-y-1 w-3/4 opacity-75 group-hover:opacity-100 transition-opacity">
                                            <div className="h-1.5 w-3/4 bg-white/20 rounded-full ml-auto" />
                                            <div className="h-1.5 w-1/2 bg-purple-500/50 rounded-full mr-auto" />
                                        </div>

                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs shadow-md">
                                                ✓
                                            </div>
                                        )}
                                    </div>

                                    <span className="text-xs font-semibold text-white truncate w-full text-center">
                                        {theme.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <button
                        type="button"
                        onClick={() => {
                            onSetCustomWallpaper?.("");
                            handleApplyTheme("default");
                        }}
                        className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                        Reset to Default
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ChatThemeModal;
