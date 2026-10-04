import React, { useContext, useEffect, useRef } from "react";
import { CallContext } from "../../context/CallContext";
import Avatar from "../common/Avatar";

const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

// Video / Audio Tile for a Remote Group Participant
const RemoteGroupParticipantTile = ({ participant, stream, callType }) => {
    const videoRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
        }
    }, [stream, callType]);

    const hasVideo = Boolean(
        callType === "video" && stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled
    );

    return (
        <div className="relative w-full h-full min-h-[160px] bg-[#141428] rounded-2xl overflow-hidden border border-white/10 shadow-xl flex items-center justify-center group">
            {/* Audio tag for remote voice */}
            <audio
                ref={audioRef}
                autoPlay
                playsInline
            />

            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-4">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-pulse" />
                        <Avatar
                            src={participant?.profilePicture}
                            name={participant?.name}
                            size={72}
                            className="shadow-xl"
                        />
                    </div>
                    <span className="text-white text-xs font-semibold tracking-wide truncate max-w-[140px]">
                        {participant?.name || "Participant"}
                    </span>
                </div>
            )}

            {/* Name Badge */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[120px]">{participant?.name || "Participant"}</span>
            </div>
        </div>
    );
};

export const CallModal = () => {
    const {
        callState,
        callType,
        remoteUser,
        isGroupCall,
        groupInfo,
        groupParticipants,
        groupRemoteStreams,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        callDuration,
        endCall,
        toggleMute,
        toggleVideo,
    } = useContext(CallContext);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);

    // Attach local stream to local video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, callType]);

    // Attach remote stream to 1-on-1 video / audio element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, callType, callState]);

    if (callState !== "calling" && callState !== "connected") {
        return null;
    }

    const isConnected = callState === "connected";
    const remoteStreamsList = Object.entries(groupRemoteStreams || {});
    const totalGroupUsers = 1 + remoteStreamsList.length;

    // Determine Group Grid Columns
    const getGridColsClass = (count) => {
        if (count <= 1) return "grid-cols-1 max-w-xl";
        if (count === 2) return "grid-cols-1 sm:grid-cols-2 max-w-4xl";
        if (count <= 4) return "grid-cols-2 max-w-4xl";
        if (count <= 6) return "grid-cols-2 sm:grid-cols-3 max-w-6xl";
        return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-7xl";
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#080812] flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-300">
            {/* Top Bar Header */}
            <div className="absolute top-0 inset-x-0 z-30 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full ring-2 ring-white/20 overflow-hidden flex items-center justify-center bg-purple-600">
                        {isGroupCall ? (
                            groupInfo?.profilePicture ? (
                                <img
                                    src={groupInfo.profilePicture}
                                    alt={groupInfo.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-white text-xs font-bold">
                                    {(groupInfo?.name || "GP").slice(0, 2).toUpperCase()}
                                </span>
                            )
                        ) : (
                            <Avatar
                                src={remoteUser?.profilePicture}
                                name={remoteUser?.name}
                                size={40}
                            />
                        )}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                            <span>{isGroupCall ? groupInfo?.name || "Group Call" : remoteUser?.name}</span>
                            {isGroupCall && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-medium border border-purple-500/30">
                                    Group ({totalGroupUsers})
                                </span>
                            )}
                        </h4>
                        <p className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-mono">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            {isConnected ? formatDuration(callDuration) : "Calling..."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs text-white/90">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5 text-emerald-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <span className="text-[11px] font-medium">End-to-End Encrypted</span>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* Main Stage: Group Call Grid VS 1-on-1 Stage */}
            {/* ========================================================================= */}
            {isGroupCall ? (
                <div className="relative w-full flex-1 pt-20 pb-28 px-4 sm:px-6 flex items-center justify-center overflow-y-auto">
                    <div className={`grid gap-4 w-full auto-rows-fr items-center justify-center ${getGridColsClass(totalGroupUsers)}`}>
                        {/* 1. Local User Tile */}
                        <div className="relative w-full h-full min-h-[180px] sm:min-h-[220px] bg-[#141428] rounded-2xl overflow-hidden border border-white/10 shadow-xl flex items-center justify-center">
                            {callType === "video" && !isVideoOff && localStream ? (
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover -scale-x-100"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 p-4">
                                    <div className="relative ring-4 ring-purple-500/30 rounded-full p-1">
                                        <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                            You
                                        </div>
                                    </div>
                                    <span className="text-zinc-400 text-xs font-medium">
                                        {isVideoOff ? "Camera Off" : "You"}
                                    </span>
                                </div>
                            )}

                            {/* Local Name Badge */}
                            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/10">
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                <span>You {isMuted ? "(Muted)" : ""}</span>
                            </div>
                        </div>

                        {/* 2. Remote Group Participants Tiles */}
                        {remoteStreamsList.map(([userId, { user: pUser, stream: pStream }]) => (
                            <RemoteGroupParticipantTile
                                key={userId}
                                participant={pUser}
                                stream={pStream}
                                callType={callType}
                            />
                        ))}

                        {/* 3. Empty state if alone in group call */}
                        {remoteStreamsList.length === 0 && (
                            <div className="col-span-full text-center py-6">
                                <p className="text-purple-300 text-sm font-medium animate-pulse">
                                    Waiting for other group members to join...
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ========================================================================= */
                /* 1-on-1 Call Layout */
                /* ========================================================================= */
                <div className="relative w-full h-full flex items-center justify-center">
                    {callType === "audio" && (
                        <audio
                            ref={(el) => {
                                remoteAudioRef.current = el;
                                if (el && remoteStream && el.srcObject !== remoteStream) {
                                    el.srcObject = remoteStream;
                                }
                            }}
                            autoPlay
                            playsInline
                        />
                    )}

                    {callType === "video" ? (
                        <>
                            {/* Remote Video Stream (Full Screen) */}
                            {isConnected && remoteStream && remoteStream.getVideoTracks().length > 0 ? (
                                <video
                                    ref={(el) => {
                                        remoteVideoRef.current = el;
                                        if (el && remoteStream && el.srcObject !== remoteStream) {
                                            el.srcObject = remoteStream;
                                        }
                                    }}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                /* Waiting / Audio state in video call */
                                <div className="flex flex-col items-center gap-5 text-center p-6">
                                    <div className="relative">
                                        <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                                        <div className="relative ring-4 ring-purple-500/30 rounded-full p-2">
                                            <Avatar
                                                src={remoteUser?.profilePicture}
                                                name={remoteUser?.name}
                                                size={120}
                                                className="shadow-2xl"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">
                                            {remoteUser?.name}
                                        </h3>
                                        <p className="text-xs text-purple-300 mt-1 font-medium">
                                            {isConnected ? "Video connected..." : "Ringing..."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Local Video Thumbnail (Picture-in-Picture) */}
                            <div className="absolute top-20 right-6 z-20 w-36 h-48 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/20 bg-black/80 backdrop-blur-md">
                                <video
                                    ref={(el) => {
                                        localVideoRef.current = el;
                                        if (el && localStream && el.srcObject !== localStream) {
                                            el.srcObject = localStream;
                                        }
                                    }}
                                    autoPlay
                                    playsInline
                                    muted
                                    className={`w-full h-full object-cover -scale-x-100 ${
                                        isVideoOff ? "hidden" : "block"
                                    }`}
                                />
                                {isVideoOff && (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 text-xs gap-1 bg-[#141428]">
                                        <span className="text-lg">📷</span>
                                        <span>Camera Off</span>
                                    </div>
                                )}
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-md">
                                    You
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Audio 1-on-1 Call Stage */
                        <div className="flex flex-col items-center gap-6 text-center p-6">
                            <div className="relative flex items-center justify-center">
                                <div className="absolute w-64 h-64 rounded-full bg-purple-600/10 animate-ping duration-1000" />
                                <div className="absolute w-48 h-48 rounded-full bg-purple-600/15 animate-pulse" />
                                <div className="relative ring-4 ring-purple-500/40 rounded-full p-2 bg-[#121226]">
                                    <Avatar
                                        src={remoteUser?.profilePicture}
                                        name={remoteUser?.name}
                                        size={120}
                                        className="shadow-2xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">
                                    {remoteUser?.name}
                                </h3>
                                <p className="text-sm text-purple-300 mt-1.5 font-medium">
                                    {isConnected ? formatDuration(callDuration) : "Calling..."}
                                </p>
                            </div>

                            {/* Animated Sound Waveform Indicator */}
                            {isConnected && (
                                <div className="flex items-center gap-1.5 h-8 mt-2">
                                    {[40, 75, 55, 90, 60, 80, 45, 70].map((h, i) => (
                                        <span
                                            key={i}
                                            className="w-1.5 bg-gradient-to-t from-purple-500 to-indigo-400 rounded-full animate-pulse"
                                            style={{
                                                height: `${h}%`,
                                                animationDelay: `${i * 120}ms`,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Controls Floating Dock */}
            <div className="absolute bottom-0 inset-x-0 z-30 p-6 sm:p-8 flex items-center justify-center bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <div className="flex items-center gap-5 px-6 py-3 rounded-full bg-[#181832]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
                    {/* Mute Microphone Button */}
                    <button
                        type="button"
                        onClick={toggleMute}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isMuted
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
                        title={isMuted ? "Unmute Mic" : "Mute Mic"}
                    >
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        )}
                    </button>

                    {/* Video Toggle Button (for Video calls) */}
                    {callType === "video" && (
                        <button
                            type="button"
                            onClick={toggleVideo}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                isVideoOff
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                        >
                            {isVideoOff ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* End / Leave Call Button */}
                    <button
                        type="button"
                        onClick={endCall}
                        className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-950/60 transition-all cursor-pointer"
                        title={isGroupCall ? "Leave Group Call" : "End Call"}
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
                </div>
            </div>
        </div>
    );
};

export default CallModal;
