import React, { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import Avatar from "../common/Avatar";
import api from "../../services/api";
import socket from "../../services/socket";

const STATUS_GRADIENTS = [
    "from-purple-600 to-indigo-700",
    "from-rose-500 to-orange-500",
    "from-emerald-500 to-teal-700",
    "from-blue-600 to-cyan-600",
    "from-amber-500 to-pink-600",
    "from-violet-700 to-fuchsia-700",
    "from-slate-800 to-zinc-950",
];

export const StatusList = ({ onOpenSettings }) => {
    const { user } = useContext(AuthContext);
    const { conversations, sendMessage, openConversation, selectConversation } =
        useContext(ChatContext);

    // Real Statuses from Backend Database
    const [statuses, setStatuses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addType, setAddType] = useState("text"); // 'text' | 'photo'
    const [statusText, setStatusText] = useState("");
    const [selectedGradient, setSelectedGradient] = useState(STATUS_GRADIENTS[0]);
    const [photoDataUrl, setPhotoDataUrl] = useState("");
    const [photoCaption, setPhotoCaption] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Viewer states
    const [activeViewingStatus, setActiveViewingStatus] = useState(null);
    const [viewerProgress, setViewerProgress] = useState(0);
    const [isViewerPaused, setIsViewerPaused] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [showViewersList, setShowViewersList] = useState(false);

    const fileInputRef = useRef(null);

    // Fetch Real Statuses from Database
    const fetchStatuses = async () => {
        try {
            const res = await api.get("/status");
            if (res.data?.success && Array.isArray(res.data?.data)) {
                setStatuses(res.data.data);
            }
        } catch (error) {
            console.error("Fetch statuses error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatuses();
    }, []);

    // Socket real-time status updates
    useEffect(() => {
        if (!socket) return;

        const handleNewStatus = (newStatus) => {
            if (!newStatus?._id) return;
            setStatuses((prev) => [
                newStatus,
                ...prev.filter((s) => (s._id || s.id) !== newStatus._id),
            ]);
        };

        const handleStatusViewed = ({ statusId, viewer, viewedAt }) => {
            setStatuses((prev) =>
                prev.map((s) => {
                    if ((s._id || s.id) === statusId) {
                        const existingViewers = s.viewers || [];
                        const alreadyIn = existingViewers.some(
                            (v) => (v.user?._id || v.user) === (viewer._id || viewer)
                        );
                        if (!alreadyIn) {
                            return {
                                ...s,
                                viewers: [...existingViewers, { user: viewer, viewedAt }],
                            };
                        }
                    }
                    return s;
                })
            );
        };

        const handleStatusDeleted = ({ statusId }) => {
            setStatuses((prev) =>
                prev.filter((s) => (s._id || s.id) !== statusId)
            );
            if (activeViewingStatus && (activeViewingStatus._id || activeViewingStatus.id) === statusId) {
                setActiveViewingStatus(null);
            }
        };

        socket.on("status:new", handleNewStatus);
        socket.on("status:viewed", handleStatusViewed);
        socket.on("status:deleted", handleStatusDeleted);

        return () => {
            socket.off("status:new", handleNewStatus);
            socket.off("status:viewed", handleStatusViewed);
            socket.off("status:deleted", handleStatusDeleted);
        };
    }, [activeViewingStatus]);

    // Split statuses: My Status vs Other Contact Statuses
    const myStatuses = statuses.filter((s) => {
        const statusUserId = s.user?._id || s.user;
        return statusUserId === user?._id || s.isMine;
    });

    const otherStatuses = statuses.filter((s) => {
        const statusUserId = s.user?._id || s.user;
        return statusUserId !== user?._id && !s.isMine;
    });

    const isStatusViewedByMe = (st) => {
        if (!user?._id) return false;
        if ((st.user?._id || st.user) === user._id) return true;
        return (
            st.viewers &&
            st.viewers.some((v) => (v.user?._id || v.user) === user._id)
        );
    };

    const unviewedStatuses = otherStatuses.filter((s) => !isStatusViewedByMe(s));
    const viewedStatuses = otherStatuses.filter((s) => isStatusViewedByMe(s));

    // Format relative time
    const formatStatusTime = (dateStr) => {
        if (!dateStr) return "";
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return "Today";
    };

    // Handle Photo Selection
    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
            alert("Image size should be under 8MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvt) => {
            setPhotoDataUrl(loadEvt.target.result);
            setAddType("photo");
        };
        reader.readAsDataURL(file);
    };

    // Add New Real Status to Database
    const handleCreateStatus = async (e) => {
        e?.preventDefault();
        if (addType === "text" && !statusText.trim()) return;
        if (addType === "photo" && !photoDataUrl) return;

        try {
            setIsSubmitting(true);
            const payload = {
                type: addType,
                text: addType === "text" ? statusText.trim() : photoCaption.trim(),
                photoUrl: addType === "photo" ? photoDataUrl : "",
                gradient: selectedGradient,
            };

            const res = await api.post("/status", payload);
            if (res.data?.success && res.data?.data) {
                const created = res.data.data;
                setStatuses((prev) => [
                    created,
                    ...prev.filter((s) => (s._id || s.id) !== created._id),
                ]);
            }

            setIsAddModalOpen(false);
            setStatusText("");
            setPhotoDataUrl("");
            setPhotoCaption("");
            setAddType("text");
        } catch (error) {
            console.error("Create status failed:", error);
            alert(error.response?.data?.message || "Failed to create status");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Status
    const handleDeleteStatus = async (statusId) => {
        if (!confirm("Are you sure you want to delete this status?")) return;
        try {
            await api.delete(`/status/${statusId}`);
            setStatuses((prev) =>
                prev.filter((s) => (s._id || s.id) !== statusId)
            );
            if (activeViewingStatus && (activeViewingStatus._id || activeViewingStatus.id) === statusId) {
                setActiveViewingStatus(null);
            }
        } catch (err) {
            console.error("Delete status error:", err);
            alert("Failed to delete status");
        }
    };

    // Open Viewer for a Status
    const handleOpenViewer = async (status) => {
        setActiveViewingStatus(status);
        setViewerProgress(0);
        setIsViewerPaused(false);
        setReplyText("");
        setShowViewersList(false);

        const statusId = status._id || status.id;
        const isMine = (status.user?._id || status.user) === user?._id || status.isMine;

        if (!isMine && !isStatusViewedByMe(status) && statusId) {
            try {
                await api.put(`/status/${statusId}/view`);
                setStatuses((prev) =>
                    prev.map((s) => {
                        if ((s._id || s.id) === statusId) {
                            const vList = s.viewers || [];
                            return {
                                ...s,
                                viewers: [
                                    ...vList,
                                    {
                                        user: {
                                            _id: user._id,
                                            name: user.name,
                                            profilePicture: user.profilePicture,
                                        },
                                        viewedAt: new Date(),
                                    },
                                ],
                            };
                        }
                        return s;
                    })
                );
            } catch (e) {
                console.error("Mark viewed error:", e);
            }
        }
    };

    // Story Player Timer Loop
    useEffect(() => {
        if (!activeViewingStatus || isViewerPaused || showViewersList) return;

        const interval = setInterval(() => {
            setViewerProgress((prev) => {
                if (prev >= 100) {
                    const allList = [...unviewedStatuses, ...viewedStatuses];
                    const currentIndex = allList.findIndex(
                        (s) => (s._id || s.id) === (activeViewingStatus._id || activeViewingStatus.id)
                    );
                    if (currentIndex !== -1 && currentIndex < allList.length - 1) {
                        const nextStatus = allList[currentIndex + 1];
                        handleOpenViewer(nextStatus);
                        return 0;
                    } else {
                        setActiveViewingStatus(null);
                        return 0;
                    }
                }
                return prev + 2; // ~5 seconds total
            });
        }, 100);

        return () => clearInterval(interval);
    }, [activeViewingStatus, isViewerPaused, showViewersList, unviewedStatuses, viewedStatuses]);

    // Send Quick Reply to Status
    const handleSendStatusReply = async (e) => {
        e?.preventDefault();
        if (!replyText.trim() || !activeViewingStatus) return;

        try {
            setIsSendingReply(true);
            const targetUser = activeViewingStatus.user;

            if (targetUser?._id) {
                let conv = conversations.find(
                    (c) =>
                        !c.isGroup &&
                        (c.user?._id === targetUser._id ||
                            c.participants?.some((p) => (p._id || p) === targetUser._id))
                );

                if (!conv) {
                    conv = await openConversation(targetUser._id);
                }

                if (conv) {
                    await selectConversation(conv);
                    await sendMessage({
                        text: `Replying to status: "${activeViewingStatus.text || "Photo"}"\n\n${replyText.trim()}`,
                    });
                }
            }

            setReplyText("");
            setActiveViewingStatus(null);
        } catch (err) {
            console.error("Status reply error:", err);
        } finally {
            setIsSendingReply(false);
        }
    };

    const latestMyStatus = myStatuses[0];
    const isOwnerOfActive =
        activeViewingStatus &&
        ((activeViewingStatus.user?._id || activeViewingStatus.user) === user?._id ||
            activeViewingStatus.isMine);

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f1c] select-none h-full border-r border-white/5">
            {/* Top Header */}
            <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
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
                        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            Status
                            {unviewedStatuses.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
                                    {unviewedStatuses.length} New
                                </span>
                            )}
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Add Status"
                        >
                            <span className="text-sm font-bold">+</span>
                            <span>Add Status</span>
                        </button>

                        {onOpenSettings && (
                            <button
                                type="button"
                                onClick={onOpenSettings}
                                className="md:hidden w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                title="Settings"
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
                        )}
                    </div>
                </div>

                <p className="text-xs text-zinc-400">
                    Status updates disappear automatically after 24 hours
                </p>
            </div>

            {/* Scrollable Status Content */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0 divide-y divide-white/[0.04]">
                {/* 1. MY STATUS SECTION */}
                <div className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between">
                        <div
                            onClick={() => {
                                if (latestMyStatus) {
                                    handleOpenViewer(latestMyStatus);
                                } else {
                                    setIsAddModalOpen(true);
                                }
                            }}
                            className="flex items-center gap-3.5 cursor-pointer group flex-1 min-w-0"
                        >
                            <div className="relative shrink-0">
                                <div
                                    className={`w-12 h-12 rounded-2xl p-0.5 flex items-center justify-center ${
                                        latestMyStatus
                                            ? "bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-md shadow-purple-600/30 ring-2 ring-purple-500/30"
                                            : "border-2 border-dashed border-zinc-600 group-hover:border-purple-400"
                                    }`}
                                >
                                    <Avatar
                                        src={user?.profilePicture}
                                        name={user?.name || "You"}
                                        size={44}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#0f0f1c] shadow-sm">
                                    +
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">
                                    My Status
                                </h3>
                                <p className="text-xs text-zinc-400 truncate mt-0.5">
                                    {latestMyStatus
                                        ? `Updated ${formatStatusTime(latestMyStatus.createdAt)} • ${
                                              latestMyStatus.viewers?.length || 0
                                          } views`
                                        : "Tap to add status update"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setAddType("text");
                                    setIsAddModalOpen(true);
                                }}
                                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                                title="Write Text Status"
                            >
                                ✍️
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    fileInputRef.current?.click();
                                }}
                                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                                title="Upload Photo Status"
                            >
                                📷
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. RECENT UPDATES SECTION */}
                {unviewedStatuses.length > 0 && (
                    <div>
                        <div className="px-5 py-2 bg-white/[0.01] border-b border-white/5 text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                            Recent Updates ({unviewedStatuses.length})
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            {unviewedStatuses.map((st) => (
                                <div
                                    key={st._id || st.id}
                                    onClick={() => handleOpenViewer(st)}
                                    className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 p-0.7 shadow-md shadow-purple-600/20 ring-2 ring-purple-500/20 shrink-0">
                                        <div className="w-full h-full rounded-[14px] bg-[#121224] p-0.5 overflow-hidden flex items-center justify-center">
                                            {st.photoUrl ? (
                                                <img
                                                    src={st.photoUrl}
                                                    alt={st.user?.name}
                                                    className="w-full h-full object-cover rounded-xl"
                                                />
                                            ) : (
                                                <Avatar
                                                    src={st.user?.profilePicture}
                                                    name={st.user?.name}
                                                    size={40}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-white truncate">
                                            {st.user?.name}
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            {formatStatusTime(st.createdAt)}
                                        </p>
                                    </div>

                                    {st.type === "photo" ? (
                                        <span className="text-xs text-zinc-500 font-medium">
                                            📷 Photo
                                        </span>
                                    ) : (
                                        <span className="text-xs text-zinc-500 font-medium truncate max-w-[80px]">
                                            ✍️ {st.text}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. VIEWED UPDATES SECTION */}
                {viewedStatuses.length > 0 && (
                    <div>
                        <div className="px-5 py-2 bg-white/[0.01] border-b border-white/5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Viewed Updates ({viewedStatuses.length})
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            {viewedStatuses.map((st) => (
                                <div
                                    key={st._id || st.id}
                                    onClick={() => handleOpenViewer(st)}
                                    className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors opacity-75 hover:opacity-100"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-700/60 p-0.5 shrink-0 ring-1 ring-white/10">
                                        <div className="w-full h-full rounded-[14px] bg-[#121224] p-0.5 overflow-hidden flex items-center justify-center">
                                            {st.photoUrl ? (
                                                <img
                                                    src={st.photoUrl}
                                                    alt={st.user?.name}
                                                    className="w-full h-full object-cover rounded-xl"
                                                />
                                            ) : (
                                                <Avatar
                                                    src={st.user?.profilePicture}
                                                    name={st.user?.name}
                                                    size={40}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-zinc-300 truncate">
                                            {st.user?.name}
                                        </h4>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {formatStatusTime(st.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty fallback */}
                {!isLoading && unviewedStatuses.length === 0 && viewedStatuses.length === 0 && myStatuses.length === 0 && (
                    <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-3xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-2xl text-purple-400">
                            ✨
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">
                                No recent status updates
                            </p>
                            <p className="text-xs text-zinc-500 mt-1 max-w-[240px]">
                                Share your thoughts or moments with friends by posting a real status update.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            className="mt-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                        >
                            + Post Status
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden Photo Input */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
            />

            {/* ========================================================
                ADD STATUS MODAL
                ======================================================== */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-[#141428] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>✨</span>
                                <span>Create Status Update</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddModalOpen(false);
                                    setPhotoDataUrl("");
                                }}
                                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Switch Type Tabs */}
                        <div className="px-5 pt-3 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setAddType("text");
                                    setPhotoDataUrl("");
                                }}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    addType === "text"
                                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                                        : "bg-white/5 text-zinc-400 hover:text-white"
                                }`}
                            >
                                ✍️ Text Status
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    fileInputRef.current?.click();
                                }}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    addType === "photo"
                                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                                        : "bg-white/5 text-zinc-400 hover:text-white"
                                }`}
                            >
                                📷 Photo Status
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleCreateStatus} className="p-5 space-y-4">
                            {addType === "text" ? (
                                <div className="space-y-3">
                                    {/* Preview Card */}
                                    <div
                                        className={`w-full h-48 rounded-2xl bg-gradient-to-br ${selectedGradient} p-5 flex items-center justify-center text-center shadow-inner relative overflow-hidden`}
                                    >
                                        <p className="text-white text-base font-medium break-words leading-relaxed max-h-36 overflow-y-auto px-2">
                                            {statusText || "Type your status message here..."}
                                        </p>
                                    </div>

                                    {/* Text Input */}
                                    <textarea
                                        value={statusText}
                                        onChange={(e) => setStatusText(e.target.value)}
                                        placeholder="What's on your mind?..."
                                        maxLength={350}
                                        rows={3}
                                        className="w-full px-3.5 py-2.5 bg-[#1b1b36] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none transition-colors"
                                        autoFocus
                                    />

                                    {/* Gradient Picker */}
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-2">
                                            Choose Background Theme
                                        </label>
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                            {STATUS_GRADIENTS.map((grad, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setSelectedGradient(grad)}
                                                    className={`w-7 h-7 rounded-xl bg-gradient-to-br ${grad} shrink-0 transition-transform ${
                                                        selectedGradient === grad
                                                            ? "ring-2 ring-white scale-110 shadow-md"
                                                            : "opacity-75 hover:opacity-100"
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {photoDataUrl ? (
                                        <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-black/40 border border-white/10">
                                            <img
                                                src={photoDataUrl}
                                                alt="Status preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPhotoDataUrl("")}
                                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full h-44 rounded-2xl border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-600/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                                        >
                                            <span className="text-3xl">📷</span>
                                            <span className="text-xs font-semibold text-purple-300">
                                                Click to select photo from device
                                            </span>
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        value={photoCaption}
                                        onChange={(e) => setPhotoCaption(e.target.value)}
                                        placeholder="Add an optional caption..."
                                        maxLength={150}
                                        className="w-full px-3.5 py-2.5 bg-[#1b1b36] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                                    />
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={
                                    isSubmitting ||
                                    (addType === "text" && !statusText.trim()) ||
                                    (addType === "photo" && !photoDataUrl)
                                }
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Posting...</span>
                                    </>
                                ) : (
                                    "Share Status"
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                FULL-SCREEN STORY PLAYER / STATUS VIEWER MODAL
                ======================================================== */}
            {activeViewingStatus && (
                <div
                    onMouseDown={() => setIsViewerPaused(true)}
                    onMouseUp={() => setIsViewerPaused(false)}
                    onTouchStart={() => setIsViewerPaused(true)}
                    onTouchEnd={() => setIsViewerPaused(false)}
                    className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex items-center justify-center p-0 md:p-4 select-none animate-in fade-in duration-150"
                >
                    <div className="relative w-full md:max-w-md h-full md:h-[85vh] bg-[#101020] md:rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
                        {/* Top Progress Bars */}
                        <div className="absolute top-0 inset-x-0 z-20 p-3 bg-gradient-to-b from-black/80 to-transparent">
                            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all ease-linear"
                                    style={{ width: `${viewerProgress}%` }}
                                />
                            </div>

                            {/* User Header */}
                            <div className="flex items-center justify-between mt-2.5">
                                <div className="flex items-center gap-2.5">
                                    <Avatar
                                        src={activeViewingStatus.user?.profilePicture}
                                        name={activeViewingStatus.user?.name}
                                        size={36}
                                        className="ring-2 ring-white/40"
                                    />
                                    <div>
                                        <h3 className="text-xs font-bold text-white">
                                            {isOwnerOfActive ? "You" : activeViewingStatus.user?.name}
                                        </h3>
                                        <p className="text-[10px] text-zinc-300">
                                            {formatStatusTime(activeViewingStatus.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    {isOwnerOfActive && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleDeleteStatus(
                                                    activeViewingStatus._id || activeViewingStatus.id
                                                )
                                            }
                                            className="w-8 h-8 rounded-full bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                                            title="Delete Status"
                                        >
                                            🗑️
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setActiveViewingStatus(null)}
                                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Story Content Area */}
                        <div className="flex-1 relative flex items-center justify-center p-6">
                            {activeViewingStatus.type === "photo" && activeViewingStatus.photoUrl ? (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <img
                                        src={activeViewingStatus.photoUrl}
                                        alt="Status"
                                        className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl"
                                    />
                                    {activeViewingStatus.text && (
                                        <div className="absolute bottom-20 inset-x-4 p-3 rounded-2xl bg-black/70 backdrop-blur-md text-white text-xs text-center">
                                            {activeViewingStatus.text}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className={`w-full h-full rounded-2xl bg-gradient-to-br ${
                                        activeViewingStatus.gradient || STATUS_GRADIENTS[0]
                                    } p-8 flex items-center justify-center text-center shadow-2xl`}
                                >
                                    <p className="text-white text-lg md:text-xl font-semibold leading-relaxed break-words max-h-96 overflow-y-auto">
                                        {activeViewingStatus.text}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Bar: If Mine -> Viewers Count; If Other -> Reply Bar */}
                        {isOwnerOfActive ? (
                            <div className="p-3 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-2 z-20">
                                <button
                                    type="button"
                                    onClick={() => setShowViewersList((prev) => !prev)}
                                    className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                    <span>👁️</span>
                                    <span>
                                        {activeViewingStatus.viewers?.length || 0} Views
                                    </span>
                                </button>

                                {showViewersList && (
                                    <div className="w-full bg-[#181830] border border-white/10 rounded-2xl p-3 max-h-40 overflow-y-auto divide-y divide-white/5 space-y-1">
                                        {activeViewingStatus.viewers &&
                                        activeViewingStatus.viewers.length > 0 ? (
                                            activeViewingStatus.viewers.map((vw, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between py-1.5 text-xs text-white"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Avatar
                                                            src={vw.user?.profilePicture}
                                                            name={vw.user?.name}
                                                            size={26}
                                                        />
                                                        <span>{vw.user?.name}</span>
                                                    </div>
                                                    <span className="text-[10px] text-zinc-400">
                                                        {formatStatusTime(vw.viewedAt)}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-xs text-zinc-500 py-2">
                                                No viewers yet
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <form
                                onSubmit={handleSendStatusReply}
                                className="p-3 bg-gradient-to-t from-black/90 to-transparent flex items-center gap-2 z-20"
                            >
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Reply to status..."
                                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-purple-400 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={!replyText.trim() || isSendingReply}
                                    className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                                >
                                    {isSendingReply ? "Sending..." : "Reply"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusList;
