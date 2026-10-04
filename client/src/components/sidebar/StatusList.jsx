import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
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

    // Real Statuses from Database
    const [statuses, setStatuses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Creation modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addType, setAddType] = useState("text"); // 'text' | 'photo'
    const [statusText, setStatusText] = useState("");
    const [selectedGradient, setSelectedGradient] = useState(STATUS_GRADIENTS[0]);
    const [photoDataUrl, setPhotoDataUrl] = useState("");
    const [photoCaption, setPhotoCaption] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Story Player States (User Group + Status Index)
    const [activeStoryGroup, setActiveStoryGroup] = useState(null); // { user, statuses: [...] }
    const [storyStatusIndex, setStoryStatusIndex] = useState(0);
    const [viewerProgress, setViewerProgress] = useState(0);
    const [isViewerPaused, setIsViewerPaused] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [showViewersList, setShowViewersList] = useState(false);

    const fileInputRef = useRef(null);

    // Fetch Statuses from Database
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

    // Socket real-time updates
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
            // If currently viewing deleted status
            setActiveStoryGroup((prevGroup) => {
                if (!prevGroup) return null;
                const remaining = prevGroup.statuses.filter(
                    (st) => (st._id || st.id) !== statusId
                );
                if (remaining.length === 0) return null;
                return { ...prevGroup, statuses: remaining };
            });
        };

        socket.on("status:new", handleNewStatus);
        socket.on("status:viewed", handleStatusViewed);
        socket.on("status:deleted", handleStatusDeleted);

        return () => {
            socket.off("status:new", handleNewStatus);
            socket.off("status:viewed", handleStatusViewed);
            socket.off("status:deleted", handleStatusDeleted);
        };
    }, []);

    // Helper: Check if status is viewed by current user
    const isStatusViewedByMe = (st) => {
        if (!user?._id || !st) return false;
        const stUserId = st.user?._id || st.user;
        if (stUserId === user._id) return true;
        return (
            st.viewers &&
            st.viewers.some((v) => (v.user?._id || v.user) === user._id)
        );
    };

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

    // ==========================================
    // GROUP STATUSES BY USER (ONE ITEM PER USER)
    // ==========================================
    const { myGroup, unviewedGroups, viewedGroups } = useMemo(() => {
        const myItems = [];
        const contactGroupsMap = new Map();

        statuses.forEach((st) => {
            const stUserId = (st.user?._id || st.user)?.toString();
            const isMine = stUserId === user?._id?.toString() || st.isMine;

            if (isMine) {
                myItems.push(st);
            } else if (stUserId) {
                if (!contactGroupsMap.has(stUserId)) {
                    contactGroupsMap.set(stUserId, {
                        userId: stUserId,
                        user: st.user,
                        statuses: [],
                    });
                }
                contactGroupsMap.get(stUserId).statuses.push(st);
            }
        });

        // 1. My Group (sorted chronologically)
        const mySorted = [...myItems].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const myGroupObj =
            mySorted.length > 0
                ? {
                      isMine: true,
                      user: user || { name: "You" },
                      statuses: mySorted,
                      latestStatus: mySorted[mySorted.length - 1],
                      count: mySorted.length,
                  }
                : null;

        // 2. Contact Groups (sorted chronologically within group)
        const contactGroups = Array.from(contactGroupsMap.values()).map((grp) => {
            const sorted = [...grp.statuses].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const allViewed = sorted.every((s) => isStatusViewedByMe(s));
            const latestStatus = sorted[sorted.length - 1];

            return {
                ...grp,
                isMine: false,
                statuses: sorted,
                latestStatus,
                allViewed,
                hasUnviewed: !allViewed,
                count: sorted.length,
            };
        });

        // Sort contact groups by the latest status creation time (descending)
        contactGroups.sort(
            (a, b) =>
                new Date(b.latestStatus.createdAt).getTime() -
                new Date(a.latestStatus.createdAt).getTime()
        );

        return {
            myGroup: myGroupObj,
            unviewedGroups: contactGroups.filter((g) => g.hasUnviewed),
            viewedGroups: contactGroups.filter((g) => g.allViewed),
        };
    }, [statuses, user]);

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

    // Add New Real Status
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

    // Delete a specific status
    const handleDeleteStatus = async (statusId) => {
        if (!confirm("Are you sure you want to delete this status?")) return;
        try {
            await api.delete(`/status/${statusId}`);
            setStatuses((prev) =>
                prev.filter((s) => (s._id || s.id) !== statusId)
            );
        } catch (err) {
            console.error("Delete status error:", err);
            alert("Failed to delete status");
        }
    };

    // Mark single status viewed in DB
    const markStatusViewed = async (status) => {
        if (!status) return;
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

    // Open Story Viewer for a User Group
    const handleOpenGroupViewer = (group) => {
        if (!group || !group.statuses || group.statuses.length === 0) return;

        // Find index of first unviewed status, or 0
        let startIdx = 0;
        if (!group.isMine) {
            const firstUnviewed = group.statuses.findIndex(
                (st) => !isStatusViewedByMe(st)
            );
            if (firstUnviewed !== -1) {
                startIdx = firstUnviewed;
            }
        }

        setActiveStoryGroup(group);
        setStoryStatusIndex(startIdx);
        setViewerProgress(0);
        setIsViewerPaused(false);
        setReplyText("");
        setShowViewersList(false);

        // Mark the initial status as viewed
        markStatusViewed(group.statuses[startIdx]);
    };

    // Navigate to next status in group or next user group
    const handleNextStory = () => {
        if (!activeStoryGroup) return;

        if (storyStatusIndex < activeStoryGroup.statuses.length - 1) {
            // Next status of same user
            const nextIdx = storyStatusIndex + 1;
            setStoryStatusIndex(nextIdx);
            setViewerProgress(0);
            markStatusViewed(activeStoryGroup.statuses[nextIdx]);
        } else {
            // Advance to next user group if available
            const allContactGroups = [...unviewedGroups, ...viewedGroups];
            const currentGroupIdx = allContactGroups.findIndex(
                (g) => g.userId === activeStoryGroup.userId
            );

            if (
                currentGroupIdx !== -1 &&
                currentGroupIdx < allContactGroups.length - 1
            ) {
                const nextGroup = allContactGroups[currentGroupIdx + 1];
                handleOpenGroupViewer(nextGroup);
            } else {
                setActiveStoryGroup(null);
            }
        }
    };

    // Navigate to previous status in group or previous user group
    const handlePrevStory = () => {
        if (!activeStoryGroup) return;

        if (storyStatusIndex > 0) {
            const prevIdx = storyStatusIndex - 1;
            setStoryStatusIndex(prevIdx);
            setViewerProgress(0);
        } else {
            // Go to previous user group if available
            const allContactGroups = [...unviewedGroups, ...viewedGroups];
            const currentGroupIdx = allContactGroups.findIndex(
                (g) => g.userId === activeStoryGroup.userId
            );

            if (currentGroupIdx > 0) {
                const prevGroup = allContactGroups[currentGroupIdx - 1];
                setActiveStoryGroup(prevGroup);
                setStoryStatusIndex(prevGroup.statuses.length - 1);
                setViewerProgress(0);
            } else {
                setViewerProgress(0);
            }
        }
    };

    // Story Player Timer Loop (~5 seconds per status)
    useEffect(() => {
        if (!activeStoryGroup || isViewerPaused || showViewersList) return;

        const interval = setInterval(() => {
            setViewerProgress((prev) => {
                if (prev >= 100) {
                    handleNextStory();
                    return 0;
                }
                return prev + 2;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [activeStoryGroup, storyStatusIndex, isViewerPaused, showViewersList, unviewedGroups, viewedGroups]);

    // Send Quick Reply to Status
    const handleSendStatusReply = async (e) => {
        e?.preventDefault();
        const currentSt = activeStoryGroup?.statuses?.[storyStatusIndex];
        if (!replyText.trim() || !currentSt) return;

        try {
            setIsSendingReply(true);
            const targetUser = activeStoryGroup.user;

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
                        text: `Replying to status: "${currentSt.text || "Photo"}"\n\n${replyText.trim()}`,
                    });
                }
            }

            setReplyText("");
            setActiveStoryGroup(null);
        } catch (err) {
            console.error("Status reply error:", err);
        } finally {
            setIsSendingReply(false);
        }
    };

    const currentViewingStatus =
        activeStoryGroup?.statuses?.[storyStatusIndex] || null;
    const isOwnerOfActive = activeStoryGroup?.isMine;

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f1c] select-none h-full border-r border-white/5">
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
                    <h2 className="text-xl font-bold text-white tracking-tight">Status</h2>
                </div>
            </div>

            {/* Scrollable Status Content */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0 divide-y divide-white/[0.04]">
                {/* 1. MY STATUS SECTION (SINGLE ITEM FOR CURRENT USER) */}
                <div className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between">
                        <div
                            onClick={() => {
                                if (myGroup) {
                                    handleOpenGroupViewer(myGroup);
                                } else {
                                    setIsAddModalOpen(true);
                                }
                            }}
                            className="flex items-center gap-3.5 cursor-pointer group flex-1 min-w-0"
                        >
                            <div className="relative shrink-0">
                                <div
                                    className={`w-12 h-12 rounded-2xl p-0.5 flex items-center justify-center ${
                                        myGroup
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
                                    {myGroup
                                        ? `${formatStatusTime(myGroup.latestStatus.createdAt)} • ${
                                              myGroup.count > 1
                                                  ? `${myGroup.count} updates`
                                                  : `${myGroup.latestStatus.viewers?.length || 0} views`
                                          }`
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

                {/* 2. RECENT UPDATES SECTION (GROUPED BY USER) */}
                {unviewedGroups.length > 0 && (
                    <div>
                        <div className="px-5 py-2 bg-white/[0.01] border-b border-white/5 text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                            Recent Updates ({unviewedGroups.length})
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            {unviewedGroups.map((grp) => (
                                <div
                                    key={grp.userId}
                                    onClick={() => handleOpenGroupViewer(grp)}
                                    className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                                >
                                    {/* Avatar with unviewed gradient ring */}
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 p-0.7 shadow-md shadow-purple-600/20 ring-2 ring-purple-500/20 shrink-0">
                                        <div className="w-full h-full rounded-[14px] bg-[#121224] p-0.5 overflow-hidden flex items-center justify-center">
                                            {grp.latestStatus.photoUrl ? (
                                                <img
                                                    src={grp.latestStatus.photoUrl}
                                                    alt={grp.user?.name}
                                                    className="w-full h-full object-cover rounded-xl"
                                                />
                                            ) : (
                                                <Avatar
                                                    src={grp.user?.profilePicture}
                                                    name={grp.user?.name}
                                                    size={40}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-white truncate">
                                            {grp.user?.name}
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            {formatStatusTime(grp.latestStatus.createdAt)}
                                            {grp.count > 1 && ` • ${grp.count} updates`}
                                        </p>
                                    </div>

                                    {grp.count > 1 ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/25">
                                            {grp.count} stories
                                        </span>
                                    ) : grp.latestStatus.type === "photo" ? (
                                        <span className="text-xs text-zinc-500 font-medium">
                                            📷 Photo
                                        </span>
                                    ) : (
                                        <span className="text-xs text-zinc-500 font-medium truncate max-w-[80px]">
                                            ✍️ {grp.latestStatus.text}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. VIEWED UPDATES SECTION (GROUPED BY USER) */}
                {viewedGroups.length > 0 && (
                    <div>
                        <div className="px-5 py-2 bg-white/[0.01] border-b border-white/5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Viewed Updates ({viewedGroups.length})
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            {viewedGroups.map((grp) => (
                                <div
                                    key={grp.userId}
                                    onClick={() => handleOpenGroupViewer(grp)}
                                    className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors opacity-75 hover:opacity-100"
                                >
                                    {/* Avatar with viewed gray ring */}
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-700/60 p-0.5 shrink-0 ring-1 ring-white/10">
                                        <div className="w-full h-full rounded-[14px] bg-[#121224] p-0.5 overflow-hidden flex items-center justify-center">
                                            {grp.latestStatus.photoUrl ? (
                                                <img
                                                    src={grp.latestStatus.photoUrl}
                                                    alt={grp.user?.name}
                                                    className="w-full h-full object-cover rounded-xl"
                                                />
                                            ) : (
                                                <Avatar
                                                    src={grp.user?.profilePicture}
                                                    name={grp.user?.name}
                                                    size={40}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-zinc-300 truncate">
                                            {grp.user?.name}
                                        </h4>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {formatStatusTime(grp.latestStatus.createdAt)}
                                            {grp.count > 1 && ` • ${grp.count} updates`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty fallback */}
                {!isLoading && unviewedGroups.length === 0 && viewedGroups.length === 0 && !myGroup && (
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
                WITH MULTI-STATUS SEGMENTED PROGRESS BARS
                ======================================================== */}
            {activeStoryGroup && currentViewingStatus && (
                <div
                    onMouseDown={() => setIsViewerPaused(true)}
                    onMouseUp={() => setIsViewerPaused(false)}
                    onTouchStart={() => setIsViewerPaused(true)}
                    onTouchEnd={() => setIsViewerPaused(false)}
                    className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex items-center justify-center p-0 md:p-4 select-none animate-in fade-in duration-150"
                >
                    <div className="relative w-full md:max-w-md h-full md:h-[85vh] bg-[#101020] md:rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
                        {/* Top Segmented Progress Bars (1 segment per status) */}
                        <div className="absolute top-0 inset-x-0 z-20 p-3 bg-gradient-to-b from-black/80 to-transparent">
                            <div className="flex items-center gap-1.5 w-full">
                                {activeStoryGroup.statuses.map((st, idx) => (
                                    <div
                                        key={st._id || idx}
                                        className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden"
                                    >
                                        <div
                                            className="h-full bg-white transition-all ease-linear"
                                            style={{
                                                width:
                                                    idx < storyStatusIndex
                                                        ? "100%"
                                                        : idx === storyStatusIndex
                                                        ? `${viewerProgress}%`
                                                        : "0%",
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* User Header */}
                            <div className="flex items-center justify-between mt-2.5">
                                <div className="flex items-center gap-2.5">
                                    <Avatar
                                        src={activeStoryGroup.user?.profilePicture}
                                        name={activeStoryGroup.user?.name}
                                        size={36}
                                        className="ring-2 ring-white/40"
                                    />
                                    <div>
                                        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <span>
                                                {isOwnerOfActive
                                                    ? "You"
                                                    : activeStoryGroup.user?.name}
                                            </span>
                                            {activeStoryGroup.statuses.length > 1 && (
                                                <span className="text-[10px] text-zinc-400 font-normal">
                                                    ({storyStatusIndex + 1}/
                                                    {activeStoryGroup.statuses.length})
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[10px] text-zinc-300">
                                            {formatStatusTime(currentViewingStatus.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    {isOwnerOfActive && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleDeleteStatus(
                                                    currentViewingStatus._id ||
                                                        currentViewingStatus.id
                                                )
                                            }
                                            className="w-8 h-8 rounded-full bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                                            title="Delete this status"
                                        >
                                            🗑️
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setActiveStoryGroup(null)}
                                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Story Content Area (Left tap = Prev, Right tap = Next) */}
                        <div className="flex-1 relative flex items-center justify-center p-6">
                            {/* Invisible touch tap zones */}
                            <div
                                onClick={handlePrevStory}
                                className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
                                title="Previous"
                            />
                            <div
                                onClick={handleNextStory}
                                className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer"
                                title="Next"
                            />

                            {currentViewingStatus.type === "photo" && currentViewingStatus.photoUrl ? (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <img
                                        src={currentViewingStatus.photoUrl}
                                        alt="Status"
                                        className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl"
                                    />
                                    {currentViewingStatus.text && (
                                        <div className="absolute bottom-20 inset-x-4 p-3 rounded-2xl bg-black/70 backdrop-blur-md text-white text-xs text-center z-15">
                                            {currentViewingStatus.text}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className={`w-full h-full rounded-2xl bg-gradient-to-br ${
                                        currentViewingStatus.gradient || STATUS_GRADIENTS[0]
                                    } p-8 flex items-center justify-center text-center shadow-2xl`}
                                >
                                    <p className="text-white text-lg md:text-xl font-semibold leading-relaxed break-words max-h-96 overflow-y-auto">
                                        {currentViewingStatus.text}
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
                                        {currentViewingStatus.viewers?.length || 0} Views
                                    </span>
                                </button>

                                {showViewersList && (
                                    <div className="w-full bg-[#181830] border border-white/10 rounded-2xl p-3 max-h-40 overflow-y-auto divide-y divide-white/5 space-y-1">
                                        {currentViewingStatus.viewers &&
                                        currentViewingStatus.viewers.length > 0 ? (
                                            currentViewingStatus.viewers.map((vw, idx) => (
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
                                                No viewers yet for this status
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
