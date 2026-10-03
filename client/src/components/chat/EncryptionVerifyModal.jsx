import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import { generateSecurityCode } from "../../utils/e2ee";

export const EncryptionVerifyModal = ({ isOpen, onClose, conversation, partner }) => {
    const [securityCode, setSecurityCode] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && conversation?._id) {
            generateSecurityCode(conversation._id).then(setSecurityCode);
        }
    }, [isOpen, conversation?._id]);

    const handleCopy = () => {
        if (!securityCode) return;
        navigator.clipboard.writeText(securityCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const chunks = securityCode ? securityCode.split(" ") : [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Verify Security Code"
            subtitle="End-to-End Encryption Verification"
            maxWidth="max-w-md"
        >
            <div className="flex flex-col items-center text-center space-y-4">
                {/* Shield Icon Badge */}
                <div className="relative">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-8 h-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.75}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                        </svg>
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-bold shadow-md">
                        ✓
                    </span>
                </div>

                {/* Summary */}
                <div>
                    <h3 className="text-base font-bold text-white">
                        256-Bit End-to-End Encrypted
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
                        Messages and calls with <span className="text-white font-semibold">{partner?.name || "this contact"}</span> are protected. No one outside of this chat, not even ChatApp, can read them.
                    </p>
                </div>

                {/* 60-digit safety number grid */}
                <div className="w-full bg-[#141426] p-4 rounded-2xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-semibold uppercase tracking-wider">
                        <span>Safety Number</span>
                        <span className="text-emerald-400 font-normal lowercase">60 digits</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center py-1">
                        {chunks.map((chunk, idx) => (
                            <div
                                key={idx}
                                className="p-1.5 rounded-lg bg-white/5 border border-white/5 font-mono text-xs font-semibold text-zinc-200 tracking-wider"
                            >
                                {chunk}
                            </div>
                        ))}
                    </div>

                    <p className="text-[11px] text-zinc-500 pt-1 leading-normal">
                        To verify encryption, compare these numbers with {partner?.name || "your contact"}'s device.
                    </p>
                </div>

                {/* Copy / Actions */}
                <div className="w-full flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {copied ? (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4 text-emerald-300"
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
                                Copied to Clipboard!
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
                                Copy Safety Number
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default EncryptionVerifyModal;
