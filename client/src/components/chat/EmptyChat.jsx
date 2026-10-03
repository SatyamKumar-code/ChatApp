import React from "react";

export const EmptyChat = ({ onOpenGroups, onOpenCreateGroup }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0a16] select-none text-center">
            {/* Glow backdrop illustration */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-2xl transform scale-150" />
                <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-2xl shadow-purple-600/30">
                    <div className="w-full h-full rounded-[22px] bg-[#121226] flex items-center justify-center text-purple-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-10 h-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                        </svg>
                    </div>
                </div>
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">
                Select a Conversation
            </h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm leading-relaxed">
                Choose a chat from the sidebar or start a new conversation with your friends and groups.
            </p>

            <div className="mt-6 flex items-center gap-3">
                {onOpenGroups && (
                    <button
                        onClick={onOpenGroups}
                        className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 active:scale-95 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <span>👥</span>
                        Browse Groups
                    </button>
                )}
                {onOpenCreateGroup && (
                    <button
                        onClick={onOpenCreateGroup}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <span>+</span>
                        New Group
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyChat;
