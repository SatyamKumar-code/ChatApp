import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import Avatar from "../common/Avatar";

export const NavigationRail = ({
    activeTab,
    setActiveTab,
    onOpenSettings,
    unreadTotal = 0,
}) => {
    const { user, logout } = useContext(AuthContext);

    return (
        <aside className="w-16 md:w-20 shrink-0 bg-[#0c0c18] border-r border-white/5 flex flex-col items-center py-4 justify-between z-20 select-none">
            {/* Top Logo */}
            <div className="flex flex-col items-center gap-6">
                <div
                    className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 ring-1 ring-white/20 transition-transform hover:scale-105"
                    title="ChatApp"
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
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>

                {/* Primary Nav Navigation */}
                <nav className="flex flex-col items-center gap-2">
                    {/* Chats tab */}
                    <button
                        onClick={() => setActiveTab("chats")}
                        title="Chats"
                        className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                            activeTab === "chats"
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        }`}
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
                                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                            />
                        </svg>

                        {unreadTotal > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-[#0c0c18]">
                                {unreadTotal > 9 ? "9+" : unreadTotal}
                            </span>
                        )}
                    </button>

                    {/* Contacts tab */}
                    <button
                        onClick={() => setActiveTab("contacts")}
                        title="Contacts"
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                            activeTab === "contacts"
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        }`}
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
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                        </svg>
                    </button>
                </nav>
            </div>

            {/* Bottom Actions: Settings & User Avatar */}
            <div className="flex flex-col items-center gap-3">
                {/* Settings Button */}
                <button
                    onClick={onOpenSettings}
                    title="Settings"
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                    </svg>
                </button>

                {/* Current User Profile Avatar */}
                <div
                    onClick={onOpenSettings}
                    title={`${user?.name || "Profile"} (Click to edit)`}
                    className="relative cursor-pointer group"
                >
                    <Avatar
                        src={user?.profilePicture}
                        name={user?.name}
                        size={38}
                        isOnline={true}
                        className="ring-2 ring-transparent group-hover:ring-purple-500 transition-all"
                    />
                </div>

                {/* Logout Button */}
                <button
                    onClick={logout}
                    title="Logout"
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
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
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                    </svg>
                </button>
            </div>
        </aside>
    );
};

export default NavigationRail;
