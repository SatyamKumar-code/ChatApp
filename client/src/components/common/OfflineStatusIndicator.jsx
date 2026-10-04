import React, { useContext } from "react";
import { ChatContext } from "../../context/ChatContext";

const OfflineStatusIndicator = () => {
    const { isOffline, justReconnected } = useContext(ChatContext);

    if (!isOffline && !justReconnected) {
        return null;
    }

    return (
        <div className="w-full z-50 transition-all duration-300">
            {isOffline && (
                <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
                        <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-5.657-2.657m0 0l2.829-2.829m-2.829 2.829L3 21m6.364-6.364a5 5 0 01-1.414-3.536m0 0l2.828-2.828M3 3l18 18" />
                        </svg>
                        <p className="flex-1 truncate">
                            <span className="font-semibold">Offline Mode:</span> You are currently offline. Viewing cached chats. Pending messages will send once reconnected.
                        </p>
                    </div>
                </div>
            )}

            {justReconnected && !isOffline && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between shadow-md animate-fadeIn">
                    <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
                        <svg className="w-4 h-4 flex-shrink-0 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="flex-1 truncate">
                            <span className="font-semibold">Back Online!</span> Reconnected. Syncing conversations and sending queued messages...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfflineStatusIndicator;
