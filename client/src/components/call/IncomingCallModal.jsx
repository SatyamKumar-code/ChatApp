import React, { useContext } from "react";
import { CallContext } from "../../context/CallContext";
import Avatar from "../common/Avatar";

export const IncomingCallModal = () => {
    const { callState, callType, remoteUser, acceptCall, rejectCall } =
        useContext(CallContext);

    if (callState !== "incoming" || !remoteUser) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
            <div className="w-full max-w-sm bg-[#16162e] border border-purple-500/30 rounded-3xl p-6 shadow-2xl shadow-purple-950/50 flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Background Ambient Glow */}
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

                {/* Pulsing Avatar with Waves */}
                <div className="relative my-4">
                    <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                    <div className="relative ring-4 ring-purple-500/30 rounded-full p-1">
                        <Avatar
                            src={remoteUser.profilePicture}
                            name={remoteUser.name}
                            size={88}
                            className="shadow-2xl"
                        />
                    </div>
                </div>

                {/* Call Info */}
                <h3 className="text-lg font-bold text-white tracking-tight mt-2">
                    {remoteUser.name}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    {remoteUser.phone}
                </p>

                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-medium">
                    <span>{callType === "video" ? "📹" : "📞"}</span>
                    <span>Incoming {callType === "video" ? "Video" : "Audio"} Call...</span>
                </div>

                {/* Action Buttons: Decline & Accept */}
                <div className="flex items-center justify-center gap-8 mt-8 w-full">
                    {/* Decline Button */}
                    <div className="flex flex-col items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => rejectCall("declined")}
                            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
                            title="Decline"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-6 h-6 rotate-[135deg]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                            </svg>
                        </button>
                        <span className="text-[11px] text-zinc-400 font-medium">Decline</span>
                    </div>

                    {/* Accept Button */}
                    <div className="flex flex-col items-center gap-1.5">
                        <button
                            type="button"
                            onClick={acceptCall}
                            className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-950/50 animate-bounce transition-all cursor-pointer"
                            title="Accept"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-6 h-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                            </svg>
                        </button>
                        <span className="text-[11px] text-emerald-400 font-medium">Accept</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;
