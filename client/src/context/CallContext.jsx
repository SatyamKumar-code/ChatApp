import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import socket from "../services/socket";
import api from "../services/api";
import { AuthContext } from "./AuthContext";
import {
    playIncomingRing,
    playOutgoingRing,
    playEndCallTone,
    stopAllCallSounds,
} from "../utils/callSounds";

export const CallContext = createContext();

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};

export const CallProvider = ({ children }) => {
    const { user } = useContext(AuthContext);

    // Call states: 'idle' | 'calling' | 'incoming' | 'connected'
    const [callState, setCallState] = useState("idle");
    const [callType, setCallType] = useState("video"); // 'audio' | 'video'
    const [remoteUser, setRemoteUser] = useState(null);
    const [conversationId, setConversationId] = useState(null);

    // Group Call States
    const [isGroupCall, setIsGroupCall] = useState(false);
    const [groupInfo, setGroupInfo] = useState(null); // { _id, name, profilePicture, isGroup }
    const [groupParticipants, setGroupParticipants] = useState([]); // array of participant user objects
    const [groupRemoteStreams, setGroupRemoteStreams] = useState({}); // { [userId]: { user, stream } }

    // Media Streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null); // For 1-on-1 calls

    // Controls
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    // Real Call History from Database
    const [callHistory, setCallHistory] = useState([]);

    // Fetch real call history from backend DB
    const fetchCallHistory = useCallback(async () => {
        if (!user?._id) return;
        try {
            const res = await api.get("/calls");
            if (res.data?.success && Array.isArray(res.data?.data)) {
                setCallHistory(res.data.data);
            }
        } catch (err) {
            console.error("Fetch call history error:", err);
        }
    }, [user?._id]);

    useEffect(() => {
        fetchCallHistory();
    }, [fetchCallHistory]);

    const addCallRecord = useCallback((record) => {
        setCallHistory((prev) => [
            {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                timestamp: new Date().toISOString(),
                ...record,
            },
            ...prev,
        ].slice(0, 80));
    }, []);

    const clearCallHistory = useCallback(async () => {
        try {
            await api.delete("/calls/clear");
            setCallHistory([]);
            localStorage.removeItem("chatapp_call_history");
        } catch (e) {
            console.error("Clear call history error:", e);
        }
    }, []);

    // WebRTC refs
    const peerConnectionRef = useRef(null); // 1-on-1 PC
    const groupPeersRef = useRef(new Map()); // Map<userId, RTCPeerConnection> for group calls
    const groupQueuesRef = useRef(new Map()); // Map<userId, candidateArray>
    const localStreamRef = useRef(null);
    const callTimerRef = useRef(null);
    const remoteUserRef = useRef(null);
    const candidateQueueRef = useRef([]);

    useEffect(() => {
        remoteUserRef.current = remoteUser;
    }, [remoteUser]);

    // Drain queued ICE candidates helper for 1-on-1
    const drainCandidates = async (peer) => {
        while (candidateQueueRef.current.length > 0) {
            const cand = candidateQueueRef.current.shift();
            try {
                await peer.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
                console.warn("Failed to add buffered ICE candidate:", err);
            }
        }
    };

    // Drain queued ICE candidates helper for Group calls
    const drainGroupCandidates = async (peer, peerUserId) => {
        const queue = groupQueuesRef.current.get(peerUserId) || [];
        while (queue.length > 0) {
            const cand = queue.shift();
            try {
                await peer.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
                console.warn("Failed to add group buffered ICE candidate:", err);
            }
        }
    };

    // Cleanup all call tracks & peer connections
    const cleanupCall = useCallback(() => {
        stopAllCallSounds();

        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        // Close 1-on-1 Peer Connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.onicecandidate = null;
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Close all Group Peer Connections
        groupPeersRef.current.forEach((pc) => {
            try {
                pc.onicecandidate = null;
                pc.ontrack = null;
                pc.close();
            } catch (e) {
                console.error("Close group peer error:", e);
            }
        });
        groupPeersRef.current.clear();
        groupQueuesRef.current.clear();

        candidateQueueRef.current = [];
        setLocalStream(null);
        setRemoteStream(null);
        setGroupRemoteStreams({});
        setIsGroupCall(false);
        setGroupInfo(null);
        setGroupParticipants([]);
        setCallState("idle");
        setRemoteUser(null);
        setConversationId(null);
        setIsMuted(false);
        setIsVideoOff(false);
        setCallDuration(0);
    }, []);

    // Create 1-on-1 RTCPeerConnection
    const createPeerConnection = useCallback((targetUserId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Send local candidates to remote peer
        pc.onicecandidate = (event) => {
            if (event.candidate && targetUserId) {
                socket.emit("call:signal", {
                    targetUserId,
                    signal: {
                        type: "candidate",
                        candidate: event.candidate,
                    },
                });
            }
        };

        // When remote tracks arrive
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else if (event.track) {
                setRemoteStream((prevStream) => {
                    const stream = prevStream || new MediaStream();
                    stream.addTrack(event.track);
                    return stream;
                });
            }
        };

        // Add local tracks to peer connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        return pc;
    }, []);

    // Create Group RTCPeerConnection for a specific participant
    const createGroupPeerConnection = useCallback(
        (targetUserId, targetUserInfo, activeConvId) => {
            const existingPc = groupPeersRef.current.get(targetUserId);
            if (existingPc) {
                try {
                    existingPc.close();
                } catch (e) {
                    console.error("Close existing group peer error:", e);
                }
            }

            const pc = new RTCPeerConnection(ICE_SERVERS);
            groupPeersRef.current.set(targetUserId, pc);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("groupCall:signal", {
                        targetUserId,
                        conversationId: activeConvId || conversationId,
                        signal: {
                            type: "candidate",
                            candidate: event.candidate,
                        },
                    });
                }
            };

            pc.ontrack = (event) => {
                const incomingStream =
                    event.streams && event.streams[0]
                        ? event.streams[0]
                        : new MediaStream([event.track]);

                setGroupRemoteStreams((prev) => ({
                    ...prev,
                    [targetUserId]: {
                        user: targetUserInfo || { _id: targetUserId, name: "Participant" },
                        stream: incomingStream,
                    },
                }));
            };

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current);
                });
            }

            return pc;
        },
        [conversationId]
    );

    // Helper to acquire media stream with fallback
    const acquireMediaStream = async (type) => {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video:
                    type === "video"
                        ? { width: { ideal: 1280 }, height: { ideal: 720 } }
                        : false,
            });
        } catch (mediaErr) {
            if (type === "video") {
                console.warn(
                    "Camera inaccessible, falling back to audio-only call:",
                    mediaErr
                );
                setCallType("audio");
                return await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false,
                });
            }
            throw mediaErr;
        }
    };

    // Start 1-on-1 Outgoing Call
    const startCall = async (targetUser, type = "video", convId = null) => {
        if (!navigator.onLine || !socket || !socket.connected) {
            window.alert("Calls unavailable while offline");
            return;
        }

        if (!targetUser || !targetUser._id) return;

        try {
            cleanupCall();
            setCallType(type);
            setIsGroupCall(false);
            setRemoteUser(targetUser);
            setConversationId(convId);
            setCallState("calling");

            playOutgoingRing();

            const stream = await acquireMediaStream(type);
            localStreamRef.current = stream;
            setLocalStream(stream);

            socket.emit("call:initiate", {
                receiverId: targetUser._id,
                callType: type,
                conversationId: convId,
            });
        } catch (err) {
            console.error("Failed to acquire media stream:", err);
            cleanupCall();
            window.alert("Microphone or camera permission required");
        }
    };

    // Start Group Audio / Video Call
    const startGroupCall = async (conversation, type = "video") => {
        if (!navigator.onLine || !socket || !socket.connected) {
            window.alert("Calls unavailable while offline");
            return;
        }

        if (!conversation || !conversation._id) return;

        try {
            cleanupCall();
            setCallType(type);
            setIsGroupCall(true);
            const groupData = {
                _id: conversation._id,
                name: conversation.groupName || conversation.name || "Group Call",
                profilePicture: conversation.groupAvatar || conversation.profilePicture || "",
                isGroup: true,
            };
            setGroupInfo(groupData);
            setConversationId(conversation._id);
            setCallState("connected");

            const stream = await acquireMediaStream(type);
            localStreamRef.current = stream;
            setLocalStream(stream);

            if (callTimerRef.current) clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            socket.emit("groupCall:initiate", {
                conversationId: conversation._id,
                callType: type,
            });
        } catch (err) {
            console.error("Failed to start group call:", err);
            cleanupCall();
            window.alert("Microphone or camera permission required");
        }
    };

    // Accept Incoming Call (Handles both 1-on-1 & Group Calls)
    const acceptCall = async () => {
        if (!socket.connected) return;

        try {
            stopAllCallSounds();
            setCallState("connected");

            const stream = await acquireMediaStream(callType);
            localStreamRef.current = stream;
            setLocalStream(stream);

            if (callTimerRef.current) clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            if (isGroupCall) {
                socket.emit("groupCall:join", {
                    conversationId,
                    callType,
                });
            } else {
                if (!remoteUser) return;
                createPeerConnection(remoteUser._id);
                socket.emit("call:accept", {
                    callerId: remoteUser._id,
                });
            }
        } catch (err) {
            console.error("Accept call error:", err);
            cleanupCall();
            alert("Could not access microphone or camera.");
        }
    };

    // Reject Call (1-on-1 or Group)
    const rejectCall = (reason = "declined") => {
        if (isGroupCall) {
            cleanupCall();
            return;
        }

        if (remoteUser && socket.connected) {
            socket.emit("call:reject", {
                callerId: remoteUser._id,
                reason,
            });
        }
        cleanupCall();
    };

    // End / Hangup / Leave Call
    const endCall = () => {
        playEndCallTone();

        if (isGroupCall && conversationId) {
            socket.emit("groupCall:leave", {
                conversationId,
            });
            cleanupCall();
            return;
        }

        if (remoteUser && socket.connected) {
            socket.emit("call:end", {
                targetUserId: remoteUser._id,
            });
        }
        cleanupCall();
    };

    // Toggle Microphone (Mute / Unmute)
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    // Toggle Camera (Video On / Off)
    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // Listen to Socket Signaling Events
    useEffect(() => {
        if (!socket.connected && user) {
            socket.connect();
        }

        // ==========================================
        // 1-on-1 Call Handlers
        // ==========================================

        const handleIncomingCall = (data) => {
            const { caller, callType: incomingType, conversationId: cId } = data;

            if (callState !== "idle") {
                socket.emit("call:reject", {
                    callerId: caller._id,
                    reason: "busy",
                });
                return;
            }

            setIsGroupCall(false);
            setGroupInfo(null);
            setRemoteUser(caller);
            setCallType(incomingType || "video");
            setConversationId(cId);
            setCallState("incoming");

            playIncomingRing();
        };

        const handleCallAccepted = async () => {
            stopAllCallSounds();
            setCallState("connected");

            if (callTimerRef.current) clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            const currentRemote = remoteUserRef.current;
            if (!currentRemote) return;

            const pc = createPeerConnection(currentRemote._id);

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.emit("call:signal", {
                    targetUserId: currentRemote._id,
                    signal: {
                        type: "offer",
                        offer,
                    },
                });
            } catch (err) {
                console.error("Create offer error:", err);
            }
        };

        const handleCallRejected = (data) => {
            playEndCallTone();
            alert(
                data.reason === "busy"
                    ? "User is on another call."
                    : "Call was declined."
            );
            cleanupCall();
        };

        const handleUserOffline = () => {
            playEndCallTone();
            alert("User is currently offline.");
            cleanupCall();
        };

        const handleCallEnded = () => {
            playEndCallTone();
            cleanupCall();
        };

        const handleCallSignal = async (data) => {
            const { senderId, signal } = data;
            const pc = peerConnectionRef.current;

            try {
                if (signal.type === "offer") {
                    const currentPc = pc || createPeerConnection(senderId);
                    await currentPc.setRemoteDescription(
                        new RTCSessionDescription(signal.offer)
                    );
                    await drainCandidates(currentPc);

                    const answer = await currentPc.createAnswer();
                    await currentPc.setLocalDescription(answer);

                    socket.emit("call:signal", {
                        targetUserId: senderId,
                        signal: {
                            type: "answer",
                            answer,
                        },
                    });
                } else if (signal.type === "answer") {
                    if (pc) {
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(signal.answer)
                        );
                        await drainCandidates(pc);
                    }
                } else if (signal.type === "candidate") {
                    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                        await pc.addIceCandidate(
                            new RTCIceCandidate(signal.candidate)
                        );
                    } else {
                        candidateQueueRef.current.push(signal.candidate);
                    }
                }
            } catch (err) {
                console.error("WebRTC 1-on-1 signal handling error:", err);
            }
        };

        // ==========================================
        // Group Call Handlers (Mesh WebRTC)
        // ==========================================

        const handleGroupCallIncoming = (data) => {
            const { caller, group, callType: incomingType, conversationId: cId } = data;

            if (callState !== "idle") {
                return; // already on call
            }

            setIsGroupCall(true);
            setGroupInfo(group);
            setRemoteUser(caller);
            setCallType(incomingType || "video");
            setConversationId(cId);
            setCallState("incoming");

            playIncomingRing();
        };

        const handleGroupCallStarted = (data) => {
            const { group, participants } = data;
            if (group) setGroupInfo(group);
            if (participants) setGroupParticipants(participants);
        };

        const handleGroupCallJoined = async (data) => {
            const { group, existingParticipants, callType: cType, conversationId: cId } = data;
            if (group) setGroupInfo(group);
            if (cType) setCallType(cType);

            // Connect to each existing participant by creating an Offer
            for (const participant of existingParticipants || []) {
                const targetId = (participant._id || participant).toString();
                const pc = createGroupPeerConnection(targetId, participant, cId || conversationId);

                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    socket.emit("groupCall:signal", {
                        targetUserId: targetId,
                        conversationId: cId || conversationId,
                        signal: {
                            type: "offer",
                            offer,
                        },
                    });
                } catch (err) {
                    console.error("Group call create offer error for peer:", targetId, err);
                }
            }
        };

        const handleGroupCallUserJoined = (data) => {
            const { user: newUser } = data;
            if (newUser) {
                setGroupParticipants((prev) => {
                    const exists = prev.some((p) => p._id.toString() === newUser._id.toString());
                    return exists ? prev : [...prev, newUser];
                });
            }
        };

        const handleGroupCallSignal = async (data) => {
            const { senderId, senderUser, conversationId: cId, signal } = data;
            if (!senderId || !signal) return;

            let pc = groupPeersRef.current.get(senderId);

            try {
                if (signal.type === "offer") {
                    if (!pc) {
                        pc = createGroupPeerConnection(senderId, senderUser, cId);
                    }
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                    await drainGroupCandidates(pc, senderId);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    socket.emit("groupCall:signal", {
                        targetUserId: senderId,
                        conversationId: cId,
                        signal: {
                            type: "answer",
                            answer,
                        },
                    });
                } else if (signal.type === "answer") {
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                        await drainGroupCandidates(pc, senderId);
                    }
                } else if (signal.type === "candidate") {
                    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    } else {
                        const q = groupQueuesRef.current.get(senderId) || [];
                        q.push(signal.candidate);
                        groupQueuesRef.current.set(senderId, q);
                    }
                }
            } catch (err) {
                console.error("Group signal error for peer:", senderId, err);
            }
        };

        const handleGroupCallUserLeft = (data) => {
            const { userId: leftUserId } = data;
            if (!leftUserId) return;

            // Close and remove peer connection
            const pc = groupPeersRef.current.get(leftUserId);
            if (pc) {
                try {
                    pc.close();
                } catch (e) {
                    console.error("Close left user PC error:", e);
                }
                groupPeersRef.current.delete(leftUserId);
                groupQueuesRef.current.delete(leftUserId);
            }

            // Remove stream
            setGroupRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[leftUserId];
                return next;
            });

            // Remove from participants
            setGroupParticipants((prev) =>
                prev.filter((p) => p._id.toString() !== leftUserId.toString())
            );
        };

        // Real-time call history sync
        const handleNewCallRecord = (callDoc) => {
            if (!callDoc?._id || !user?._id) return;
            const isCaller = (callDoc.caller?._id || callDoc.caller) === user._id;
            let contactUser;

            if (callDoc.isGroupCall) {
                contactUser = {
                    _id: callDoc.conversation?._id || callDoc._id,
                    name: callDoc.conversation?.groupName || "Group Call",
                    profilePicture: callDoc.conversation?.groupAvatar || "",
                    isGroup: true,
                };
            } else {
                contactUser = isCaller ? callDoc.receiver : callDoc.caller;
            }

            let directionStatus = callDoc.status;
            if (callDoc.status === "completed" || callDoc.status === "rejected") {
                directionStatus = isCaller ? "outgoing" : "incoming";
            } else if (callDoc.status === "missed") {
                directionStatus = isCaller ? "outgoing" : "missed";
            }

            const formatted = {
                id: callDoc._id.toString(),
                _id: callDoc._id.toString(),
                user: contactUser || { name: "Unknown", phone: "", profilePicture: "" },
                isCaller,
                isGroupCall: Boolean(callDoc.isGroupCall),
                callType: callDoc.callType || "video",
                status: directionStatus,
                originalStatus: callDoc.status,
                duration: callDoc.duration || 0,
                timestamp: callDoc.createdAt,
                createdAt: callDoc.createdAt,
            };

            setCallHistory((prev) => [
                formatted,
                ...prev.filter((c) => (c._id || c.id) !== formatted.id),
            ]);
        };

        socket.on("call:incoming", handleIncomingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("call:rejected", handleCallRejected);
        socket.on("call:userOffline", handleUserOffline);
        socket.on("call:ended", handleCallEnded);
        socket.on("call:signal", handleCallSignal);
        socket.on("call:newRecord", handleNewCallRecord);

        socket.on("groupCall:incoming", handleGroupCallIncoming);
        socket.on("groupCall:started", handleGroupCallStarted);
        socket.on("groupCall:joined", handleGroupCallJoined);
        socket.on("groupCall:userJoined", handleGroupCallUserJoined);
        socket.on("groupCall:signal", handleGroupCallSignal);
        socket.on("groupCall:userLeft", handleGroupCallUserLeft);

        return () => {
            socket.off("call:incoming", handleIncomingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("call:rejected", handleCallRejected);
            socket.off("call:userOffline", handleUserOffline);
            socket.off("call:ended", handleCallEnded);
            socket.off("call:signal", handleCallSignal);
            socket.off("call:newRecord", handleNewCallRecord);

            socket.off("groupCall:incoming", handleGroupCallIncoming);
            socket.off("groupCall:started", handleGroupCallStarted);
            socket.off("groupCall:joined", handleGroupCallJoined);
            socket.off("groupCall:userJoined", handleGroupCallUserJoined);
            socket.off("groupCall:signal", handleGroupCallSignal);
            socket.off("groupCall:userLeft", handleGroupCallUserLeft);
        };
    }, [
        user,
        callState,
        conversationId,
        isGroupCall,
        cleanupCall,
        createPeerConnection,
        createGroupPeerConnection,
    ]);

    const value = {
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
        callHistory,
        clearCallHistory,
        addCallRecord,
        startCall,
        startGroupCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
    };

    return (
        <CallContext.Provider value={value}>
            {children}
        </CallContext.Provider>
    );
};

export default CallProvider;
