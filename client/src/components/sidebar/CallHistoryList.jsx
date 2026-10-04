import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { CallContext } from "../../context/CallContext";
import Avatar from "../common/Avatar";

export const CallHistoryList = ({ onOpenSettings }) => {
    const { user } = useContext(AuthContext);
    const { conversations, contacts } = useContext(ChatContext);
    const { callHistory, clearCallHistory, startCall, startGroupCall } =
        useContext(CallContext);

    const [searchQuery, setSearchQuery] = useState("");
    const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
    const [newCallSearch, setNewCallSearch] = useState("");

    // Real call history from database
    const displayHistory = callHistory || [];

    const formatCallTime = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;

        if (diff < 86400000 && d.getDate() === now.getDate()) {
            return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        }
        if (diff < 172800000) {
            return `Yesterday, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        }
        return d.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDuration = (secs) => {
        if (!secs) return "";
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        return `${mins}m ${s}s`;
    };

    // Filter calls by search
    const filteredCalls = displayHistory.filter((call) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const name = call.user?.name?.toLowerCase() || "";
        const phone = call.user?.phone || "";
        return name.includes(q) || phone.includes(q);
    });

    // Candidates for new call (from 1-on-1 conversations & contacts)
    const combinedUsers = [];
    const seenUserIds = new Set();

    (conversations || []).forEach((c) => {
        if (!c.isGroup && c.user?._id) {
            if (!seenUserIds.has(c.user._id) && c.user._id !== user?._id) {
                seenUserIds.add(c.user._id);
                combinedUsers.push(c.user);
            }
        }
    });

    (contacts || []).forEach((ct) => {
        const u = ct.contactUser || ct.user;
        if (u?._id && !seenUserIds.has(u._id) && u._id !== user?._id) {
            seenUserIds.add(u._id);
            combinedUsers.push(u);
        }
    });

    const callCandidates = combinedUsers.filter((u) => {
        if (!newCallSearch.trim()) return true;
        const q = newCallSearch.toLowerCase();
        return (
            u.name?.toLowerCase().includes(q) || u.phone?.includes(q)
        );
    });

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f1c] select-none h-full border-r border-white/5 relative">
            {/* Header */}
            <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 md:py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onOpenSettings && (
                        <div
                            onClick={onOpenSettings}
                            className="md:hidden cursor-pointer active:scale-95 transition-transform"
                            title="Profile & Settings"
                        >
                            <Avatar
                                src={user?.profilePicture}
                                name={user?.name}
                                size={34}
                                isOnline={true}
                            />
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-white tracking-tight">Calls</h2>
                </div>
            </div>

            {/* Call Logs List */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0 divide-y divide-white/[0.03]">
                {filteredCalls.length > 0 ? (
                    filteredCalls.map((call) => {
                        const callUser = call.user || { name: "Unknown", phone: "" };
                        const isMissed = call.status === "missed";
                        const isOutgoing = call.status === "outgoing";

                        return (
                            <div
                                key={call.id}
                                className="group flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                            >
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    <Avatar
                                        src={callUser.profilePicture}
                                        name={callUser.name}
                                        size={44}
                                    />

                                    <div className="flex-1 min-w-0">
                                        <h4
                                            className={`text-sm font-semibold truncate ${isMissed ? "text-rose-400" : "text-white"
                                                }`}
                                        >
                                            {callUser.name}
                                        </h4>

                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {/* Status Direction Icon */}
                                            {isMissed && (
                                                <span className="text-rose-500 font-bold text-xs" title="Missed Call">
                                                    ↙
                                                </span>
                                            )}
                                            {!isMissed && isOutgoing && (
                                                <span className="text-cyan-400 font-bold text-xs" title="Outgoing Call">
                                                    ↗
                                                </span>
                                            )}
                                            {!isMissed && !isOutgoing && (
                                                <span className="text-emerald-400 font-bold text-xs" title="Incoming Call">
                                                    ↙
                                                </span>
                                            )}

                                            {/* Call Type Indicator */}
                                            {call.callType === "video" ? (
                                                <span className="text-[11px]" title="Video Call">
                                                    📹
                                                </span>
                                            ) : (
                                                <span className="text-[11px]" title="Audio Call">
                                                    📞
                                                </span>
                                            )}

                                            <span className="text-[11px] text-zinc-400">
                                                {formatCallTime(call.timestamp)}
                                            </span>

                                            {call.duration > 0 && (
                                                <span className="text-[10px] text-zinc-500 font-mono">
                                                    • {formatDuration(call.duration)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Call Back Action - Only Audio if audio call, only Video if video call */}
                                <div className="flex items-center shrink-0 ml-2">
                                    {call.callType === "video" ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (call.isGroupCall || callUser.isGroup) {
                                                    startGroupCall(callUser, "video");
                                                } else {
                                                    startCall(callUser, "video");
                                                }
                                            }}
                                            className="w-9 h-9 rounded-xl bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                            title="Video Call"
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
                                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                            </svg>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (call.isGroupCall || callUser.isGroup) {
                                                    startGroupCall(callUser, "audio");
                                                } else {
                                                    startCall(callUser, "audio");
                                                }
                                            }}
                                            className="w-9 h-9 rounded-xl bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                            title="Audio Call"
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
                                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-3xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-2xl text-purple-400">
                            📞
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">
                                {searchQuery ? "No matching calls found" : "No call history"}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1 max-w-[240px]">
                                Start an audio or video call with your contacts anytime.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsNewCallModalOpen(true)}
                            className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                        >
                            + Start a Call
                        </button>
                    </div>
                )}
            </div>

            {/* ========================================================
                START NEW CALL MODAL
                ======================================================== */}
            {isNewCallModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-[#141428] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>📞</span>
                                <span>Start a New Call</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsNewCallModalOpen(false)}
                                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-4 border-b border-white/5">
                            <input
                                type="text"
                                value={newCallSearch}
                                onChange={(e) => setNewCallSearch(e.target.value)}
                                placeholder="Search contact to call..."
                                className="w-full px-3.5 py-2.5 bg-[#1b1b36] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                                autoFocus
                            />
                        </div>

                        {/* Contacts List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03] max-h-80">
                            {callCandidates.length > 0 ? (
                                callCandidates.map((candidate) => (
                                    <div
                                        key={candidate._id}
                                        className="flex items-center justify-between p-3.5 px-5 hover:bg-white/[0.04] transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <Avatar
                                                src={candidate.profilePicture}
                                                name={candidate.name}
                                                size={40}
                                                isOnline={candidate.isOnline}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs font-semibold text-white truncate">
                                                    {candidate.name}
                                                </h4>
                                                <p className="text-[11px] text-zinc-400 font-mono truncate">
                                                    {candidate.phone}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsNewCallModalOpen(false);
                                                    startCall(candidate, "audio");
                                                }}
                                                className="w-8 h-8 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                                title="Audio Call"
                                            >
                                                📞
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsNewCallModalOpen(false);
                                                    startCall(candidate, "video");
                                                }}
                                                className="w-8 h-8 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                                title="Video Call"
                                            >
                                                📹
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-xs text-zinc-400">
                                    No contacts found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CallHistoryList;
