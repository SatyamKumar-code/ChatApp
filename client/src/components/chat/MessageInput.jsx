import React, { useContext, useRef, useState } from "react";
import { ChatContext } from "../../context/ChatContext";

const QUICK_EMOJIS = [
    "😊", "😂", "❤️", "👍", "🔥", "🎉", "🙏", "✨",
    "🚀", "😍", "🥳", "😎", "💯", "👋", "👏", "🤔"
];

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const MessageInput = ({ onSendMessage, onTyping, onStopTyping, disabled = false, disabledReason = "" }) => {
    const { replyingTo, clearReplyingTo } = useContext(ChatContext);
    const [text, setText] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const inputRef = useRef(null);
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);

    // Audio recording refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);

    // Process selected image or document
    const processFile = (file) => {
        if (!file) return;

        // 8MB limit
        if (file.size > 8 * 1024 * 1024) {
            setErrorMsg("File is too large. Maximum size is 8MB.");
            setTimeout(() => setErrorMsg(""), 4000);
            return;
        }

        const isImage = file.type.startsWith("image/");
        const reader = new FileReader();

        reader.onload = (e) => {
            setSelectedFile({
                file,
                fileUrl: e.target.result,
                fileName: file.name,
                fileSize: file.size,
                messageType: isImage ? "image" : "file",
                isImage,
            });
            setShowAttachMenu(false);
            inputRef.current?.focus();
        };

        reader.onerror = () => {
            setErrorMsg("Failed to read file.");
            setTimeout(() => setErrorMsg(""), 3000);
        };

        reader.readAsDataURL(file);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
        e.target.value = "";
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const file = item.getAsFile();
                if (file) {
                    processFile(file);
                    e.preventDefault();
                    break;
                }
            }
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    };

    // ==============================
    // VOICE RECORDING HANDLERS
    // ==============================

    const startVoiceRecording = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setErrorMsg("Microphone recording is not supported in this browser.");
                setTimeout(() => setErrorMsg(""), 3500);
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            let options = { mimeType: "audio/webm" };
            if (MediaRecorder.isTypeSupported("audio/webm")) {
                options = { mimeType: "audio/webm" };
            } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                options = { mimeType: "audio/mp4" };
            } else {
                options = undefined;
            }

            const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start(200);
            setIsRecording(true);
            setRecordingDuration(0);
            setShowAttachMenu(false);
            setShowEmojiPicker(false);

            timerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Mic error:", err);
            setErrorMsg("Microphone permission denied. Please allow mic access.");
            setTimeout(() => setErrorMsg(""), 4000);
        }
    };

    const stopVoiceRecording = (shouldSend = true) => {
        if (!mediaRecorderRef.current || !isRecording) return;

        clearInterval(timerRef.current);
        setIsRecording(false);

        const recorder = mediaRecorderRef.current;
        const currentDuration = recordingDuration;

        recorder.onstop = () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }

            if (!shouldSend) {
                audioChunksRef.current = [];
                return;
            }

            const mimeType = recorder.mimeType || "audio/webm";
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

            if (audioBlob.size === 0) return;

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result;
                onSendMessage({
                    text: "",
                    fileUrl: base64Audio,
                    fileName: `Voice Note (${currentDuration}s).webm`,
                    fileSize: audioBlob.size,
                    duration: currentDuration,
                    messageType: "audio",
                });
            };
            reader.readAsDataURL(audioBlob);
            audioChunksRef.current = [];
        };

        recorder.stop();
    };

    // ==============================
    // SUBMIT & INPUT
    // ==============================

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmedText = text.trim();

        if ((!trimmedText && !selectedFile) || disabled) return;

        if (selectedFile) {
            onSendMessage({
                text: trimmedText,
                fileUrl: selectedFile.fileUrl,
                fileName: selectedFile.fileName,
                fileSize: selectedFile.fileSize,
                messageType: selectedFile.messageType,
            });
            setSelectedFile(null);
        } else {
            onSendMessage(trimmedText);
        }

        setText("");
        onStopTyping?.();
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" && replyingTo) {
            clearReplyingTo();
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleChange = (e) => {
        const val = e.target.value;
        setText(val);
        if (val.trim()) {
            onTyping?.();
        } else {
            onStopTyping?.();
        }
    };

    const handleSelectEmoji = (emoji) => {
        setText((prev) => prev + emoji);
        inputRef.current?.focus();
    };

    const hasMessageContent = Boolean(text.trim() || selectedFile);

    if (disabledReason) {
        return (
            <div className="p-4 bg-[#0d0d1c]/60 backdrop-blur-md border-t border-white/5 flex items-center justify-center select-none animate-in fade-in duration-200">
                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#151528]/80 backdrop-blur-sm border border-white/10 text-zinc-400 text-xs font-medium shadow-inner">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 text-purple-400 shrink-0"
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
                    <span>{disabledReason}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 md:p-4 relative">
            {/* Replying Preview Banner */}
            {replyingTo && (
                <div className="mb-2.5 flex items-center justify-between p-2.5 rounded-xl bg-[#181832] border border-purple-500/30 border-l-4 border-l-purple-500 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
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
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-purple-300 truncate">
                                Replying to {replyingTo.sender?.name || "User"}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate max-w-xs md:max-w-md">
                                {replyingTo.messageType === "image" && "📷 Photo"}
                                {replyingTo.messageType === "audio" && "🎤 Voice note"}
                                {replyingTo.messageType === "file" &&
                                    `📄 ${replyingTo.fileName || "Document"}`}
                                {(!replyingTo.messageType ||
                                    replyingTo.messageType === "text") &&
                                    (replyingTo.text || "Message")}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={clearReplyingTo}
                        className="w-6 h-6 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors ml-2 shrink-0 cursor-pointer"
                        title="Cancel reply (Esc)"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Hidden file inputs */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.ppt,.pptx,.csv"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Error Message Toast */}
            {errorMsg && (
                <div className="absolute bottom-full left-4 mb-2 px-4 py-2 bg-rose-500/90 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-950/40 animate-in fade-in z-30 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errorMsg}
                </div>
            )}

            {/* Emoji Quick Picker Popup */}
            {showEmojiPicker && !isRecording && (
                <div className="absolute bottom-full left-4 sm:left-14 mb-2 p-3 bg-[#16162c] border border-white/10 rounded-2xl shadow-xl shadow-black/50 z-30 animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-2rem)]">
                    <div className="grid grid-cols-8 gap-1.5">
                        {QUICK_EMOJIS.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => handleSelectEmoji(emoji)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-white/10 active:scale-90 transition-transform"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Attachment Menu Popup */}
            {showAttachMenu && !isRecording && (
                <div className="absolute bottom-full left-4 mb-2 w-48 p-1.5 bg-[#16162c] border border-white/10 rounded-2xl shadow-xl shadow-black/50 z-30 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <button
                        type="button"
                        onClick={() => {
                            setShowAttachMenu(false);
                            imageInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-200 hover:text-white hover:bg-white/10 transition-all text-left group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p>Photo or Image</p>
                            <span className="text-[10px] text-zinc-500 font-normal">PNG, JPG, WebP</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setShowAttachMenu(false);
                            fileInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-200 hover:text-white hover:bg-white/10 transition-all text-left group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <p>Document</p>
                            <span className="text-[10px] text-zinc-500 font-normal">PDF, DOC, ZIP</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Selected File Preview Box (Above message input) */}
            {selectedFile && !isRecording && (
                <div className="max-w-5xl mx-auto mb-2 p-2.5 rounded-2xl bg-[#16162a] border border-white/10 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                        {selectedFile.isImage ? (
                            <img
                                src={selectedFile.fileUrl}
                                alt="Preview"
                                className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate max-w-xs md:max-w-md">
                                {selectedFile.fileName}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                {formatBytes(selectedFile.fileSize)} • {selectedFile.isImage ? "Image" : "Document"}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleRemoveFile}
                        title="Remove attachment"
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 hover:text-rose-400 text-zinc-400 flex items-center justify-center transition-all shrink-0 ml-2"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ========================================================
                VOICE RECORDING LIVE BAR vs STANDARD INPUT
                ======================================================== */}
            {isRecording ? (
                <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto p-1.5 rounded-2xl bg-[#1a1426] border border-rose-500/30 animate-in fade-in duration-200">
                    {/* Live recording indicator & timer */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center w-6 h-6">
                            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute opacity-75" />
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative" />
                        </div>
                        <span className="text-xs font-semibold text-rose-400 font-mono tracking-wider">
                            Recording...
                        </span>
                        <span className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg">
                            {formatDuration(recordingDuration)}
                        </span>
                    </div>

                    {/* Animated sound wave bars */}
                    <div className="flex items-center gap-1 h-5 hidden sm:flex">
                        {[40, 80, 50, 95, 60, 100, 70, 45, 85, 55, 75, 90].map((h, i) => (
                            <span
                                key={i}
                                className="w-1 bg-rose-400/80 rounded-full animate-pulse"
                                style={{
                                    height: `${h}%`,
                                    animationDuration: "800ms",
                                    animationDelay: `${i * 75}ms`,
                                }}
                            />
                        ))}
                    </div>

                    {/* Actions: Cancel (Trash) & Send Voice Note */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => stopVoiceRecording(false)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 text-xs font-medium transition-all flex items-center gap-1.5"
                            title="Discard recording"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={() => stopVoiceRecording(true)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
                            title="Send voice note"
                        >
                            <span>Send</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 max-w-5xl mx-auto"
                >
                    {/* Paperclip attachment button */}
                    <button
                        type="button"
                        onClick={() => {
                            setShowAttachMenu(!showAttachMenu);
                            setShowEmojiPicker(false);
                        }}
                        title="Attach photo or document"
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                            showAttachMenu || selectedFile
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5 -rotate-45"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                        </svg>
                    </button>

                    {/* Input Area */}
                    <div className="flex-1 relative flex items-center bg-[#181830]/80 backdrop-blur-sm rounded-2xl border border-white/10 focus-within:border-purple-500/50 focus-within:bg-[#1c1c38]/90 transition-all px-3.5 py-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={text}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            onBlur={() => onStopTyping?.()}
                            placeholder={selectedFile ? "Add an optional caption..." : "Type a message or paste image..."}
                            disabled={disabled}
                            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none py-2"
                        />

                        {/* Emoji Trigger */}
                        <button
                            type="button"
                            onClick={() => {
                                setShowEmojiPicker(!showEmojiPicker);
                                setShowAttachMenu(false);
                            }}
                            className={`text-lg p-1.5 rounded-lg transition-transform hover:scale-110 active:scale-95 ${
                                showEmojiPicker ? "opacity-100" : "opacity-60 hover:opacity-100"
                            }`}
                            title="Emoji"
                        >
                            😊
                        </button>
                    </div>

                    {/* Send Button OR Voice Note Mic Button */}
                    {hasMessageContent ? (
                        <button
                            type="submit"
                            disabled={disabled}
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 disabled:opacity-40 disabled:scale-100 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 transition-all shrink-0 cursor-pointer"
                            title="Send"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4 translate-x-0.5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={startVoiceRecording}
                            disabled={disabled}
                            className="w-10 h-10 rounded-xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 hover:border-transparent text-purple-300 hover:text-white active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm hover:shadow-purple-600/40"
                            title="Record Voice Note"
                        >
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
                                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                            </svg>
                        </button>
                    )}
                </form>
            )}
        </div>
    );
};

export default MessageInput;
