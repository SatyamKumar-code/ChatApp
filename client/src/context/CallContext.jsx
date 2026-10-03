import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import socket from "../services/socket";
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

    // Media Streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Controls
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    // WebRTC refs
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const callTimerRef = useRef(null);
    const remoteUserRef = useRef(null);
    const candidateQueueRef = useRef([]);

    useEffect(() => {
        remoteUserRef.current = remoteUser;
    }, [remoteUser]);

    // Cleanup tracks & peer connection
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

        if (peerConnectionRef.current) {
            peerConnectionRef.current.onicecandidate = null;
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        candidateQueueRef.current = [];
        setLocalStream(null);
        setRemoteStream(null);
        setCallState("idle");
        setRemoteUser(null);
        setConversationId(null);
        setIsMuted(false);
        setIsVideoOff(false);
        setCallDuration(0);
    }, []);

    // Create RTCPeerConnection
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
            console.log("Remote track received:", event);
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

    // Start Call (Outgoing)
    const startCall = async (targetUser, type = "video", convId = null) => {
        if (!targetUser || !targetUser._id || !socket.connected) return;

        try {
            cleanupCall();
            setCallType(type);
            setRemoteUser(targetUser);
            setConversationId(convId);
            setCallState("calling");

            // Play outgoing tone
            playOutgoingRing();

            // Request camera / microphone with fallback
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
                });
            } catch (mediaErr) {
                if (type === "video") {
                    console.warn("Camera inaccessible, falling back to audio-only call:", mediaErr);
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    setCallType("audio");
                } else {
                    throw mediaErr;
                }
            }

            localStreamRef.current = stream;
            setLocalStream(stream);

            // Signal intent to backend
            socket.emit("call:initiate", {
                receiverId: targetUser._id,
                callType: type,
                conversationId: convId,
            });
        } catch (err) {
            console.error("Failed to acquire media stream:", err);
            cleanupCall();
            alert("Could not access microphone or camera. Please check browser permissions.");
        }
    };

    // Accept Incoming Call
    const acceptCall = async () => {
        if (!remoteUser || !socket.connected) return;

        try {
            stopAllCallSounds();
            setCallState("connected");

            // Get local stream with fallback
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
                });
            } catch (mediaErr) {
                if (callType === "video") {
                    console.warn("Camera inaccessible, falling back to audio-only call:", mediaErr);
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    setCallType("audio");
                } else {
                    throw mediaErr;
                }
            }

            localStreamRef.current = stream;
            setLocalStream(stream);

            // Create peer connection
            const pc = createPeerConnection(remoteUser._id);

            // Start timer
            callTimerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            // Notify caller that call was accepted
            socket.emit("call:accept", {
                callerId: remoteUser._id,
            });
        } catch (err) {
            console.error("Accept call error:", err);
            cleanupCall();
            alert("Could not access microphone or camera.");
        }
    };

    // Reject Call
    const rejectCall = (reason = "declined") => {
        if (remoteUser && socket.connected) {
            socket.emit("call:reject", {
                callerId: remoteUser._id,
                reason,
            });
        }
        cleanupCall();
    };

    // End / Hangup Call
    const endCall = () => {
        playEndCallTone();
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

        // 1. Incoming Call Alert
        const handleIncomingCall = (data) => {
            const { caller, callType: incomingType, conversationId: cId } = data;

            // If already on a call, auto-reject with busy
            if (callState !== "idle") {
                socket.emit("call:reject", {
                    callerId: caller._id,
                    reason: "busy",
                });
                return;
            }

            setRemoteUser(caller);
            setCallType(incomingType || "video");
            setConversationId(cId);
            setCallState("incoming");

            playIncomingRing();
        };

        // 2. Outgoing Call Accepted by Remote Peer
        const handleCallAccepted = async () => {
            stopAllCallSounds();
            setCallState("connected");

            // Start call duration timer
            if (callTimerRef.current) clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            // Initiator creates WebRTC Offer
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

        // 3. Outgoing Call Rejected or Busy
        const handleCallRejected = (data) => {
            playEndCallTone();
            alert(
                data.reason === "busy"
                    ? "User is on another call."
                    : "Call was declined."
            );
            cleanupCall();
        };

        // 4. Remote User is Offline
        const handleUserOffline = () => {
            playEndCallTone();
            alert("User is currently offline.");
            cleanupCall();
        };

        // 5. Remote Peer Ended Call
        const handleCallEnded = () => {
            playEndCallTone();
            cleanupCall();
        };

        // Drain queued ICE candidates helper
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

        // 6. Handle WebRTC Signaling (Offer, Answer, ICE Candidates)
        const handleCallSignal = async (data) => {
            const { senderId, signal } = data;
            const pc = peerConnectionRef.current;

            try {
                if (signal.type === "offer") {
                    // Receiver receives offer, sets remote description & sends answer
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
                    // Caller receives answer
                    if (pc) {
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(signal.answer)
                        );
                        await drainCandidates(pc);
                    }
                } else if (signal.type === "candidate") {
                    // Receive ICE candidate with race-condition buffer
                    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                        await pc.addIceCandidate(
                            new RTCIceCandidate(signal.candidate)
                        );
                    } else {
                        candidateQueueRef.current.push(signal.candidate);
                    }
                }
            } catch (err) {
                console.error("WebRTC signal handling error:", err);
            }
        };

        socket.on("call:incoming", handleIncomingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("call:rejected", handleCallRejected);
        socket.on("call:userOffline", handleUserOffline);
        socket.on("call:ended", handleCallEnded);
        socket.on("call:signal", handleCallSignal);

        return () => {
            socket.off("call:incoming", handleIncomingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("call:rejected", handleCallRejected);
            socket.off("call:userOffline", handleUserOffline);
            socket.off("call:ended", handleCallEnded);
            socket.off("call:signal", handleCallSignal);
        };
    }, [user, callState, cleanupCall, createPeerConnection]);

    const value = {
        callState,
        callType,
        remoteUser,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        callDuration,
        startCall,
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
