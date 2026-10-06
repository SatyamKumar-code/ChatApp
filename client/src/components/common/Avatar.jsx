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
    className = "",
    onClick,
}) => {
    const [imageError, setImageError] = useState(false);
    const hasImage = Boolean(src && !imageError);

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
        </div>
    );
};

export default Avatar;
