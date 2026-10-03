import React, { useRef, useState } from "react";
import Avatar from "../common/Avatar";

export const ProfilePhotoUpload = ({
    currentPhoto = "",
    name = "",
    onPhotoSelected,
    onPhotoRemoved,
}) => {
    const fileInputRef = useRef(null);
    const [previewPhoto, setPreviewPhoto] = useState(currentPhoto);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Process and compress image file to standard avatar dimensions (~400x400)
    const handleFile = (file) => {
        if (!file) return;

        setError("");
        if (!file.type.startsWith("image/")) {
            setError("Please select a valid image file (PNG, JPG, WEBP).");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Image size should be less than 5MB.");
            return;
        }

        setIsProcessing(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Compress & resize on canvas
                const canvas = document.createElement("canvas");
                const maxSize = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
                setPreviewPhoto(compressedBase64);
                onPhotoSelected?.(compressedBase64);
                setIsProcessing(false);
            };
            img.onerror = () => {
                setError("Failed to process image.");
                setIsProcessing(false);
            };
            img.src = e.target.result;
        };

        reader.onerror = () => {
            setError("Failed to read image file.");
            setIsProcessing(false);
        };

        reader.readAsDataURL(file);
    };

    const handleInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleRemove = () => {
        setPreviewPhoto("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        onPhotoRemoved?.();
    };

    return (
        <div className="flex flex-col items-center gap-4 py-2">
            {/* Hidden Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
            />

            {/* Avatar Preview with Camera Overlay */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer rounded-full p-1.5 transition-all duration-300 ${
                    isDragging
                        ? "ring-4 ring-purple-500 ring-offset-4 ring-offset-[#121224] scale-105"
                        : "ring-2 ring-purple-500/30 hover:ring-purple-500/80 ring-offset-2 ring-offset-[#121224]"
                }`}
            >
                <Avatar
                    src={previewPhoto}
                    name={name}
                    size={96}
                    showStatus={false}
                    className="shadow-xl"
                />

                {/* Hover / Active Camera Overlay */}
                <div className="absolute inset-1.5 rounded-full bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 select-none">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-6 h-6 text-purple-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                    </svg>
                    <span className="text-[10px] font-medium text-purple-200">
                        Change
                    </span>
                </div>

                {isProcessing && (
                    <div className="absolute inset-1.5 rounded-full bg-black/80 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5"
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                    </svg>
                    Upload Photo
                </button>

                {previewPhoto && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 active:bg-rose-500/30 text-zinc-400 hover:text-rose-400 text-xs font-semibold border border-white/10 hover:border-rose-500/30 transition-all flex items-center gap-1.5"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                        Remove
                    </button>
                )}
            </div>

            {/* Helper text or error */}
            {error ? (
                <p className="text-xs text-rose-400 font-medium">{error}</p>
            ) : (
                <p className="text-[11px] text-zinc-500">
                    JPG, PNG or WEBP up to 5MB. Click or drag & drop.
                </p>
            )}
        </div>
    );
};

export default ProfilePhotoUpload;
