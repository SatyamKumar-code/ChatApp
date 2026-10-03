import React, { useState } from "react";

// Deterministic gradient generator based on user name
const getAvatarGradient = (name = "") => {
    if (!name) return "from-purple-600 to-indigo-600";
    const gradients = [
        "from-violet-600 to-indigo-600",
        "from-pink-600 to-rose-600",
        "from-cyan-600 to-blue-600",
        "from-amber-500 to-orange-600",
        "from-emerald-500 to-teal-600",
        "from-purple-600 to-fuchsia-600",
        "from-orange-500 to-amber-600",
        "from-blue-600 to-purple-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
};

const getInitials = (name = "") => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "?";
};

export const Avatar = ({
    src = "",
    name = "",
    size = 44,
    isOnline = undefined,
    className = "",
    showStatus = true,
    onClick,
}) => {
    const [imageError, setImageError] = useState(false);
    const hasImage = Boolean(src && !imageError);

    // Online indicator dot size
    const dotSize = Math.max(9, Math.round(size * 0.24));

    return (
        <div
            onClick={onClick}
            className={`relative inline-flex items-center justify-center shrink-0 select-none ${
                onClick ? "cursor-pointer transition-transform hover:scale-105 active:scale-95" : ""
            } ${className}`}
            style={{ width: `${size}px`, height: `${size}px` }}
        >
            {hasImage ? (
                <img
                    src={src}
                    alt={name || "User avatar"}
                    onError={() => setImageError(true)}
                    className="w-full h-full rounded-full object-cover shadow-sm ring-1 ring-white/10"
                />
            ) : (
                <div
                    className={`w-full h-full rounded-full bg-gradient-to-br ${getAvatarGradient(
                        name
                    )} flex items-center justify-center font-semibold text-white tracking-wider shadow-sm ring-1 ring-white/10`}
                    style={{ fontSize: `${Math.round(size * 0.38)}px` }}
                >
                    {getInitials(name)}
                </div>
            )}

            {/* Online / Offline status badge */}
            {showStatus && isOnline !== undefined && (
                <span
                    className={`absolute bottom-0 right-0 rounded-full ring-2 ring-[#0a0a14] ${
                        isOnline ? "bg-emerald-500" : "bg-zinc-500"
                    }`}
                    style={{
                        width: `${dotSize}px`,
                        height: `${dotSize}px`,
                    }}
                >
                    {isOnline && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    )}
                </span>
            )}
        </div>
    );
};

export default Avatar;
