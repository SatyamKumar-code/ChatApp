import React, { useState } from "react";
import AudioPlayer from "../chat/AudioPlayer";

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

export const MediaGallery = ({ messages = [] }) => {
    const [activeTab, setActiveTab] = useState("photos");
    const [lightboxImage, setLightboxImage] = useState(null);

    // Filter valid, non-deleted media
    const validMessages = messages.filter(
        (m) => !m.isDeleted && !m.deletedForEveryone && m.fileUrl
    );

    const photos = validMessages.filter(
        (m) =>
            m.messageType === "image" ||
            m.fileUrl.startsWith("data:image") ||
            m.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );

    const audioNotes = validMessages.filter(
        (m) =>
            m.messageType === "audio" ||
            m.fileUrl.startsWith("data:audio") ||
            m.fileUrl.includes("audio/")
    );

    const docs = validMessages.filter(
        (m) =>
            m.messageType === "file" ||
            (!photos.includes(m) && !audioNotes.includes(m))
    );

    return (
        <div className="space-y-3">
            {/* Gallery Sub-Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141428] border border-white/5 text-xs select-none">
                <button
                    type="button"
                    onClick={() => setActiveTab("photos")}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === "photos"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                            : "text-zinc-400 hover:text-white"
                    }`}
                >
                    <span>🖼️ Photos</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                        {photos.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("audio")}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === "audio"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                            : "text-zinc-400 hover:text-white"
                    }`}
                >
                    <span>🎙️ Voice</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                        {audioNotes.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("docs")}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === "docs"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                            : "text-zinc-400 hover:text-white"
                    }`}
                >
                    <span>📄 Docs</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                        {docs.length}
                    </span>
                </button>
            </div>

            {/* Tab 1: Photos Grid */}
            {activeTab === "photos" && (
                <div>
                    {photos.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500 bg-[#141426] rounded-2xl border border-white/5">
                            <span className="text-2xl block mb-1">🖼️</span>
                            No photos shared yet
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1 pr-1.5">
                            {photos.map((item) => (
                                <div
                                    key={item._id}
                                    onClick={() =>
                                        setLightboxImage({
                                            url: item.fileUrl,
                                            name: item.fileName || "Photo",
                                        })
                                    }
                                    className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-purple-500/50 transition-all bg-black/30"
                                >
                                    <img
                                        src={item.fileUrl}
                                        alt={item.fileName || "Shared photo"}
                                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
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
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Voice Notes */}
            {activeTab === "audio" && (
                <div>
                    {audioNotes.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500 bg-[#141426] rounded-2xl border border-white/5">
                            <span className="text-2xl block mb-1">🎙️</span>
                            No voice recordings shared yet
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {audioNotes.map((item) => (
                                <div
                                    key={item._id}
                                    className="p-2.5 rounded-2xl bg-[#141426] border border-white/5 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                        <span className="font-semibold text-white truncate">
                                            {item.sender?.name || "Voice note"}
                                        </span>
                                        <span className="font-mono text-[10px]">
                                            {formatDate(item.createdAt)}
                                        </span>
                                    </div>
                                    <AudioPlayer
                                        audioUrl={item.fileUrl}
                                        duration={item.duration}
                                        isMyMessage={false}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Documents List */}
            {activeTab === "docs" && (
                <div>
                    {docs.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500 bg-[#141426] rounded-2xl border border-white/5">
                            <span className="text-2xl block mb-1">📄</span>
                            No files or documents shared yet
                        </div>
                    ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {docs.map((item) => (
                                <a
                                    key={item._id}
                                    href={item.fileUrl}
                                    download={item.fileName || "document"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#141426] border border-white/5 hover:border-white/15 hover:bg-white/[0.03] transition-all group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
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
                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-white truncate group-hover:underline">
                                                {item.fileName || "Attachment document"}
                                            </p>
                                            <p className="text-[10px] text-zinc-400 font-mono">
                                                {formatBytes(item.fileSize)} • {formatDate(item.createdAt)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-purple-600 text-zinc-400 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
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
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                            />
                                        </svg>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Lightbox Image Preview Modal */}
            {lightboxImage && (
                <div
                    onClick={() => setLightboxImage(null)}
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                >
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <a
                            href={lightboxImage.url}
                            download={lightboxImage.name}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
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
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                            </svg>
                            Download
                        </a>
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    <img
                        src={lightboxImage.url}
                        alt="Preview"
                        onClick={(e) => e.stopPropagation()}
                        className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                    />

                    {lightboxImage.name && (
                        <p className="text-xs text-zinc-400 mt-3 font-mono">
                            {lightboxImage.name}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default MediaGallery;
