import React, { useState } from "react";
import Modal from "./Modal";

export const InviteModal = ({ isOpen, onClose, phone }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const cleanPhone = phone?.replace(/\D/g, "") || "";
    const inviteUrl = `${window.location.origin}/register`;
    const inviteMessage = `Hey! I'm using ChatApp to chat securely. Join me here: ${inviteUrl}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleWhatsAppShare = () => {
        const targetNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const url = `https://api.whatsapp.com/send?phone=${targetNumber}&text=${encodeURIComponent(
            inviteMessage
        )}`;
        window.open(url, "_blank");
    };

    const handleSmsShare = () => {
        const url = `sms:${cleanPhone}?body=${encodeURIComponent(inviteMessage)}`;
        window.open(url, "_blank");
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Invite to ChatApp"
            subtitle="Connect with anyone even if they haven't joined yet"
            maxWidth="max-w-md"
        >
            <div className="space-y-5">
                {/* Phone badge / info */}
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#16162a] border border-white/5">
                    <div className="w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
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
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white font-mono">
                            {cleanPhone ? `+91 ${cleanPhone}` : "Phone Number"}
                        </p>
                        <p className="text-xs text-amber-400/90 font-medium mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Not registered on ChatApp yet
                        </p>
                    </div>
                </div>

                {/* Invite link box */}
                <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        ChatApp Invite Link
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={inviteUrl}
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#141426] border border-white/5 text-xs text-zinc-300 font-mono outline-none select-all"
                        />
                        <button
                            onClick={handleCopy}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                                copied
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30"
                            }`}
                        >
                            {copied ? (
                                <>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-4 h-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    Copied!
                                </>
                            ) : (
                                <>
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
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Copy Link
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Direct Share Options */}
                <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Quick Send
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            onClick={handleWhatsAppShare}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg
                                className="w-4 h-4 fill-current"
                                viewBox="0 0 24 24"
                            >
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                            </svg>
                            WhatsApp
                        </button>

                        <button
                            onClick={handleSmsShare}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                            </svg>
                            SMS Invite
                        </button>
                    </div>
                </div>

                <div className="pt-2 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default InviteModal;
