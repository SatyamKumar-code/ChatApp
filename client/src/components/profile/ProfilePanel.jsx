import React, { useContext, useEffect, useRef, useState } from "react";
import Avatar from "../common/Avatar";
import MediaGallery from "./MediaGallery";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { CallContext } from "../../context/CallContext";

export const ProfilePanel = ({
    partner,
    conversation,
    onClose,
    onOpenVerifyEncryption,
}) => {
    const { user } = useContext(AuthContext);
    const { startCall } = useContext(CallContext);
    const {
        contacts,
        messages,
        searchUsers,
        addGroupMembers,
        leaveOrRemoveGroupMember,
        updateGroup,
        toggleGroupAdmin,
    } = useContext(ChatContext);

    const isGroup = partner?.isGroup || conversation?.isGroup;
    const participants =
        conversation?.participants || partner?.participants || [];
    const groupAdminId =
        conversation?.groupAdmin?._id ||
        conversation?.groupAdmin ||
        partner?.groupAdmin?._id ||
        partner?.groupAdmin;

    const groupAdminsList =
        conversation?.groupAdmins ||
        partner?.groupAdmins ||
        [];

    const isGroupOwner = Boolean(
        groupAdminId &&
        user?._id &&
        (groupAdminId._id || groupAdminId).toString() === user._id.toString()
    );

    const isCurrentUserAdmin =
        isGroup &&
        (isGroupOwner ||
            groupAdminsList.some(
                (a) => (a?._id || a)?.toString() === user?._id?.toString()
            ));

    const groupSettings = conversation?.groupSettings || partner?.groupSettings || {
        onlyAdminsCanEditInfo: false,
        onlyAdminsCanSendMessages: false,
        onlyAdminsCanAddMembers: false,
    };

    const canEditGroupInfo = isGroup && (isCurrentUserAdmin || !groupSettings.onlyAdminsCanEditInfo);
    const canAddMembers = isGroup && (isCurrentUserAdmin || !groupSettings.onlyAdminsCanAddMembers);

    // Group editing state
    const [isEditingGroup, setIsEditingGroup] = useState(false);
    const [editGroupName, setEditGroupName] = useState("");
    const [editGroupDesc, setEditGroupDesc] = useState("");
    const [editGroupAvatar, setEditGroupAvatar] = useState("");
    const [openMemberMenuId, setOpenMemberMenuId] = useState(null);
    const [photoError, setPhotoError] = useState("");
    const avatarFileInputRef = useRef(null);

    // Group settings state
    const [settingsState, setSettingsState] = useState({
        onlyAdminsCanEditInfo: Boolean(groupSettings.onlyAdminsCanEditInfo),
        onlyAdminsCanSendMessages: Boolean(groupSettings.onlyAdminsCanSendMessages),
        onlyAdminsCanAddMembers: Boolean(groupSettings.onlyAdminsCanAddMembers),
    });

    useEffect(() => {
        const currentSettings = conversation?.groupSettings || partner?.groupSettings || {};
        setSettingsState({
            onlyAdminsCanEditInfo: Boolean(currentSettings.onlyAdminsCanEditInfo),
            onlyAdminsCanSendMessages: Boolean(currentSettings.onlyAdminsCanSendMessages),
            onlyAdminsCanAddMembers: Boolean(currentSettings.onlyAdminsCanAddMembers),
        });
    }, [conversation?.groupSettings, partner?.groupSettings]);

    // Add member state
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [panelTab, setPanelTab] = useState("overview"); // "overview" | "media"

    if (!partner) return null;

    const formatLastSeen = (date) => {
        if (!date) return "Offline";
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000 && d.getDate() === now.getDate()) {
            return `Today at ${d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}`;
        }
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    // Search members to add
    const handleSearchMembers = async (val) => {
        setMemberSearch(val);
        if (val.trim().length >= 2) {
            setSearching(true);
            try {
                const results = await searchUsers(val.trim());
                // Filter out already existing participants
                const existingIds = new Set(
                    participants.map((p) => p._id?.toString() || p.toString())
                );
                setSearchResults(
                    (results || []).filter((u) => !existingIds.has(u._id))
                );
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setSearching(false);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleAddMember = async (memberId) => {
        if (!conversation?._id || !memberId) return;
        try {
            setIsActionLoading(true);
            await addGroupMembers(conversation._id, [memberId]);
            setIsAddingMember(false);
            setMemberSearch("");
            setSearchResults([]);
        } catch (err) {
            console.error("Failed to add member:", err);
            alert(err.response?.data?.message || "Failed to add member");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!conversation?._id || !memberId) return;
        const confirmRemove = window.confirm(
            "Are you sure you want to remove this member from the group?"
        );
        if (!confirmRemove) return;

        try {
            setIsActionLoading(true);
            await leaveOrRemoveGroupMember(conversation._id, memberId);
        } catch (err) {
            console.error("Failed to remove member:", err);
            alert(err.response?.data?.message || "Failed to remove member");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleStartEditGroup = () => {
        setEditGroupName(conversation?.groupName || partner?.name || "");
        setEditGroupDesc(
            conversation?.groupDescription || partner?.groupDescription || ""
        );
        setEditGroupAvatar(
            conversation?.groupAvatar || partner?.profilePicture || ""
        );
        setPhotoError("");
        setIsEditingGroup(true);
    };

    const handleAvatarFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setPhotoError("Please select a valid image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setPhotoError("Image size must be less than 5MB");
            return;
        }

        setPhotoError("");
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            setEditGroupAvatar(uploadEvent.target.result);
        };
        reader.onerror = () => {
            setPhotoError("Failed to read image file");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleSaveGroupEdit = async () => {
        if (!conversation?._id || !editGroupName.trim()) return;
        try {
            setIsActionLoading(true);
            await updateGroup(conversation._id, {
                groupName: editGroupName.trim(),
                groupDescription: editGroupDesc.trim(),
                groupAvatar: editGroupAvatar.trim(),
            });
            setIsEditingGroup(false);
        } catch (err) {
            console.error("Failed to update group:", err);
            alert(err.response?.data?.message || "Failed to update group");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleToggleSetting = async (key) => {
        if (!conversation?._id || !isCurrentUserAdmin) return;
        const newSettings = {
            ...settingsState,
            [key]: !settingsState[key],
        };
        setSettingsState(newSettings);

        try {
            setIsActionLoading(true);
            await updateGroup(conversation._id, {
                groupSettings: newSettings,
            });
        } catch (err) {
            console.error("Failed to update group setting:", err);
            // Revert on error
            setSettingsState({
                onlyAdminsCanEditInfo: Boolean(groupSettings.onlyAdminsCanEditInfo),
                onlyAdminsCanSendMessages: Boolean(groupSettings.onlyAdminsCanSendMessages),
                onlyAdminsCanAddMembers: Boolean(groupSettings.onlyAdminsCanAddMembers),
            });
            alert(err.response?.data?.message || "Failed to update group settings");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleToggleAdmin = async (memberId) => {
        if (!conversation?._id || !memberId) return;
        try {
            setIsActionLoading(true);
            setOpenMemberMenuId(null);
            await toggleGroupAdmin(conversation._id, memberId);
        } catch (err) {
            console.error("Failed to toggle admin role:", err);
            alert(err.response?.data?.message || "Failed to change admin role");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!conversation?._id) return;
        const confirmLeave = window.confirm(
            "Are you sure you want to leave this group?"
        );
        if (!confirmLeave) return;

        try {
            setIsActionLoading(true);
            await leaveOrRemoveGroupMember(conversation._id, user._id);
            onClose?.();
        } catch (err) {
            console.error("Failed to leave group:", err);
            alert(err.response?.data?.message || "Failed to leave group");
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <aside className="fixed md:relative inset-y-0 right-0 z-40 w-full sm:w-96 md:w-80 lg:w-96 shrink-0 bg-[#0c0c18] border-l border-white/5 flex flex-col h-full select-none animate-in slide-in-from-right duration-200 shadow-2xl">
            {/* Header */}
            <div className="h-16 px-5 border-b border-white/5 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold text-white tracking-tight">
                    {isGroup ? "Group Details" : "Contact Details"}
                </h3>
                <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    title="Close Details"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            {/* Tab Switcher: Overview vs Media & Files */}
            <div className="px-5 pt-3 shrink-0">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141426] border border-white/5 text-xs select-none">
                    <button
                        type="button"
                        onClick={() => setPanelTab("overview")}
                        className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                            panelTab === "overview"
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Overview
                    </button>
                    <button
                        type="button"
                        onClick={() => setPanelTab("media")}
                        className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                            panelTab === "media"
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Media & Files
                    </button>
                </div>
            </div>

            {/* Profile / Group Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {panelTab === "media" ? (
                    <MediaGallery messages={messages} />
                ) : (
                    <>
                        {/* Group Edit Mode */}
                        {isEditingGroup ? (
                            <div className="bg-[#141426] p-4 rounded-2xl border border-purple-500/30 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                                        <span>✏️</span>
                                        <span>Edit Group Info</span>
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingGroup(false)}
                                        className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                {photoError && (
                                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
                                        {photoError}
                                    </div>
                                )}

                                {/* Avatar Upload / Preview */}
                                <div className="flex flex-col items-center gap-2">
                                    <div className="relative group">
                                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-4xl shadow-lg shadow-purple-950/40 ring-2 ring-purple-500/30 overflow-hidden">
                                            {editGroupAvatar ? (
                                                editGroupAvatar.startsWith("http") ||
                                                editGroupAvatar.startsWith("data:") ? (
                                                    <img
                                                        src={editGroupAvatar}
                                                        alt="Group"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    editGroupAvatar
                                                )
                                            ) : (
                                                "👥"
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => avatarFileInputRef.current?.click()}
                                            className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold transition-opacity cursor-pointer"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-5 h-5 mb-0.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                            </svg>
                                            Upload
                                        </button>
                                    </div>

                                    {/* Hidden File Input */}
                                    <input
                                        type="file"
                                        ref={avatarFileInputRef}
                                        onChange={handleAvatarFileUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => avatarFileInputRef.current?.click()}
                                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                                        >
                                            <span>📷</span>
                                            <span>Upload Photo</span>
                                        </button>
                                        {editGroupAvatar && (
                                            <button
                                                type="button"
                                                onClick={() => setEditGroupAvatar("👥")}
                                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 text-[11px] transition-colors cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                                        Group Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={editGroupName}
                                        onChange={(e) => setEditGroupName(e.target.value)}
                                        placeholder="Group name"
                                        maxLength={50}
                                        className="w-full px-3 py-1.5 bg-[#0f0f1e] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={editGroupDesc}
                                        onChange={(e) => setEditGroupDesc(e.target.value)}
                                        rows={2}
                                        maxLength={150}
                                        placeholder="What's this group about?"
                                        className="w-full px-3 py-1.5 bg-[#0f0f1e] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                                        Or Choose Emoji Icon
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {["👥", "🚀", "💬", "🎮", "💻", "🎯", "🔥", "💡", "🌟", "🍕", "🏆", "🛡️"].map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setEditGroupAvatar(emoji)}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer ${
                                                    editGroupAvatar === emoji
                                                        ? "bg-purple-600 ring-2 ring-purple-400 scale-105"
                                                        : "bg-white/5 hover:bg-white/10 text-white"
                                                }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={editGroupAvatar}
                                        onChange={(e) => setEditGroupAvatar(e.target.value)}
                                        placeholder="Or image URL / custom emoji..."
                                        className="w-full px-3 py-1 bg-[#0f0f1e] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                                    />
                                </div>

                                <button
                                    type="button"
                                    disabled={isActionLoading || !editGroupName.trim()}
                                    onClick={handleSaveGroupEdit}
                                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isActionLoading ? "Saving Changes..." : "Save Changes"}
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Avatar & Title */}
                                <div className="flex flex-col items-center text-center">
                                    {isGroup ? (
                                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-4xl shadow-xl shadow-purple-950/40 ring-4 ring-purple-500/20 overflow-hidden">
                                            {partner.profilePicture ? (
                                                partner.profilePicture.startsWith("http") ||
                                                partner.profilePicture.startsWith("data:") ? (
                                                    <img
                                                        src={partner.profilePicture}
                                                        alt={partner.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    partner.profilePicture
                                                )
                                            ) : (
                                                "👥"
                                            )}
                                        </div>
                                    ) : (
                                        <Avatar
                                            src={partner.profilePicture}
                                            name={partner.name}
                                            size={80}
                                            isOnline={partner.isOnline}
                                            className="shadow-xl ring-2 ring-purple-500/20"
                                        />
                                    )}

                                    <h2 className="text-base font-bold text-white mt-3">
                                        {partner.name}
                                    </h2>

                                    {isGroup ? (
                                        <div className="flex flex-col items-center gap-1.5 mt-0.5">
                                            <p className="text-xs text-purple-300 font-medium">
                                                {participants.length} group participants
                                            </p>
                                            {canEditGroupInfo && (
                                                <button
                                                    type="button"
                                                    onClick={handleStartEditGroup}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-purple-600/20 text-purple-300 hover:text-purple-200 border border-white/10 hover:border-purple-500/30 text-xs font-medium transition-all cursor-pointer"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="w-3.5 h-3.5"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                                        />
                                                    </svg>
                                                    <span>Edit Group</span>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                                {partner.phone}
                                            </p>
                                            <div className="mt-2">
                                                {partner.isOnline ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        Online Now
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/5 text-zinc-400 text-xs font-medium">
                                                        Last seen {formatLastSeen(partner.lastSeen)}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Description / Bio */}
                                <div className="bg-[#141426] p-3.5 rounded-2xl border border-white/5 space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                        {isGroup ? "Group Description" : "About"}
                                    </span>
                                    <p className="text-xs text-zinc-200 leading-relaxed">
                                        {isGroup
                                            ? partner.groupDescription || "No group description."
                                            : partner.about || "Hey there! I am using ChatApp."}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* ========================================================
                            GROUP SETTINGS / PERMISSIONS (ADMIN ONLY)
                            ======================================================== */}
                        {isGroup && isCurrentUserAdmin && (
                            <div className="bg-[#141426] p-3.5 rounded-2xl border border-purple-500/20 space-y-3 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between pb-1 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">🛡️</span>
                                        <div>
                                            <h4 className="text-xs font-semibold text-white">
                                                Group Permissions
                                            </h4>
                                            <p className="text-[10px] text-zinc-400">
                                                Admin controls for group members
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold">
                                        Admin Only
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {/* 1. Send Messages Permission */}
                                    <div className="p-2.5 rounded-xl bg-[#0f0f1e] border border-white/5 flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-white flex items-center gap-1.5">
                                                <span>💬</span>
                                                <span>Send Messages</span>
                                            </p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                                                {settingsState.onlyAdminsCanSendMessages
                                                    ? "Only admins can send messages"
                                                    : "All participants can send messages"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={isActionLoading}
                                            onClick={() => handleToggleSetting("onlyAdminsCanSendMessages")}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                                                settingsState.onlyAdminsCanSendMessages
                                                    ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                                                    : "bg-white/10 text-zinc-300 hover:bg-white/15"
                                            }`}
                                        >
                                            {settingsState.onlyAdminsCanSendMessages ? "🔒 Admins Only" : "👥 All Members"}
                                        </button>
                                    </div>

                                    {/* 2. Add Members Permission */}
                                    <div className="p-2.5 rounded-xl bg-[#0f0f1e] border border-white/5 flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-white flex items-center gap-1.5">
                                                <span>➕</span>
                                                <span>Add Other Members</span>
                                            </p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                                                {settingsState.onlyAdminsCanAddMembers
                                                    ? "Only admins can add new members"
                                                    : "All participants can add new members"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={isActionLoading}
                                            onClick={() => handleToggleSetting("onlyAdminsCanAddMembers")}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                                                settingsState.onlyAdminsCanAddMembers
                                                    ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                                                    : "bg-white/10 text-zinc-300 hover:bg-white/15"
                                            }`}
                                        >
                                            {settingsState.onlyAdminsCanAddMembers ? "🔒 Admins Only" : "👥 All Members"}
                                        </button>
                                    </div>

                                    {/* 3. Edit Group Info Permission */}
                                    <div className="p-2.5 rounded-xl bg-[#0f0f1e] border border-white/5 flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-white flex items-center gap-1.5">
                                                <span>⚙️</span>
                                                <span>Edit Group Info</span>
                                            </p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                                                {settingsState.onlyAdminsCanEditInfo
                                                    ? "Only admins can change name, icon & desc"
                                                    : "All participants can change name, icon & desc"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={isActionLoading}
                                            onClick={() => handleToggleSetting("onlyAdminsCanEditInfo")}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                                                settingsState.onlyAdminsCanEditInfo
                                                    ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                                                    : "bg-white/10 text-zinc-300 hover:bg-white/15"
                                            }`}
                                        >
                                            {settingsState.onlyAdminsCanEditInfo ? "🔒 Admins Only" : "👥 All Members"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* End-to-End Encryption Security Card */}
                        <div
                            onClick={onOpenVerifyEncryption}
                            className="p-3.5 rounded-2xl bg-[#141426] border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
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
                                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                                        <span>End-to-End Encryption</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    </h4>
                                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                                        Click to verify 60-digit safety code
                                    </p>
                                </div>
                            </div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>

                        {/* ========================================================
                            GROUP PARTICIPANTS SECTION
                            ======================================================== */}
                        {isGroup && (
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                                        Participants ({participants.length})
                                    </span>
                                    {canAddMembers && (
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingMember(!isAddingMember)}
                                            className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                            <span>{isAddingMember ? "Close" : "+ Add Member"}</span>
                                        </button>
                                    )}
                                </div>

                                {/* Inline Add Member Picker */}
                                {isAddingMember && canAddMembers && (
                                    <div className="p-3 bg-[#171732] rounded-2xl border border-purple-500/30 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                                        <input
                                            type="text"
                                            value={memberSearch}
                                            onChange={(e) => handleSearchMembers(e.target.value)}
                                            placeholder="Search users to add..."
                                            className="w-full px-3 py-1.5 bg-[#0f0f1e] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                            autoFocus
                                        />

                                        <div className="max-h-36 overflow-y-auto divide-y divide-white/5">
                                            {searching ? (
                                                <div className="p-2 text-center text-xs text-zinc-500">
                                                    Searching...
                                                </div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="p-2 text-center text-xs text-zinc-500">
                                                    {memberSearch.trim()
                                                        ? "No users found"
                                                        : "Type name or phone"}
                                                </div>
                                            ) : (
                                                searchResults.map((userToAdd) => (
                                                    <div
                                                        key={userToAdd._id}
                                                        className="flex items-center justify-between py-1.5 px-1 hover:bg-white/5 rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar
                                                                src={userToAdd.profilePicture}
                                                                name={userToAdd.name}
                                                                size={26}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-xs text-white font-medium truncate">
                                                                    {userToAdd.name}
                                                                </p>
                                                                <p className="text-[10px] text-zinc-400 font-mono">
                                                                    {userToAdd.phone}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={isActionLoading}
                                                            onClick={() => handleAddMember(userToAdd._id)}
                                                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Participants List */}
                                <div className="bg-[#141426] rounded-2xl border border-white/5 divide-y divide-white/[0.04] overflow-hidden max-h-64 overflow-y-auto">
                                    {participants.map((member) => {
                                        const memberId = member._id?.toString() || member.toString();
                                        const isSelf = memberId === user?._id?.toString();
                                        const isOwner = memberId === (groupAdminId?._id || groupAdminId)?.toString();
                                        const isCoAdmin = groupAdminsList.some(
                                            (a) => (a?._id || a)?.toString() === memberId
                                        );

                                        return (
                                            <div
                                                key={memberId}
                                                className="flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors relative"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Avatar
                                                        src={member.profilePicture}
                                                        name={member.name || "User"}
                                                        size={32}
                                                        isOnline={member.isOnline}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                                                            <span>
                                                                {member.name || "User"}
                                                            </span>
                                                            {isSelf && (
                                                                <span className="text-[10px] text-purple-400 font-normal">
                                                                    (You)
                                                                </span>
                                                            )}
                                                        </p>
                                                        {member.phone && (
                                                            <p className="text-[10px] text-zinc-400 font-mono">
                                                                {member.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isOwner ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                                                            <span>👑</span>
                                                            <span>Owner</span>
                                                        </span>
                                                    ) : isCoAdmin ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold flex items-center gap-1">
                                                            <span>⭐</span>
                                                            <span>Admin</span>
                                                        </span>
                                                    ) : null}

                                                    {/* Admin options menu for other members (cannot manage owner) */}
                                                    {isCurrentUserAdmin && !isSelf && !isOwner && (
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setOpenMemberMenuId(
                                                                        openMemberMenuId === memberId ? null : memberId
                                                                    )
                                                                }
                                                                className="w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Member options"
                                                            >
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    className="w-4 h-4"
                                                                    viewBox="0 0 20 20"
                                                                    fill="currentColor"
                                                                >
                                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                                </svg>
                                                            </button>

                                                            {openMemberMenuId === memberId && (
                                                                <>
                                                                    <div
                                                                        className="fixed inset-0 z-30"
                                                                        onClick={() => setOpenMemberMenuId(null)}
                                                                    />
                                                                    <div className="absolute right-0 top-8 w-44 bg-[#18182e] border border-white/10 rounded-xl shadow-2xl py-1 z-40 animate-in fade-in zoom-in-95 duration-150">
                                                                        <button
                                                                            type="button"
                                                                            disabled={isActionLoading}
                                                                            onClick={() => handleToggleAdmin(memberId)}
                                                                            className="w-full px-3 py-2 text-left text-xs text-white hover:bg-purple-600/20 hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer"
                                                                        >
                                                                            <span>{isCoAdmin ? "👤" : "⭐"}</span>
                                                                            <span>{isCoAdmin ? "Dismiss as Admin" : "Make Group Admin"}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isActionLoading}
                                                                            onClick={() => {
                                                                                setOpenMemberMenuId(null);
                                                                                handleRemoveMember(memberId);
                                                                            }}
                                                                            className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                                                                        >
                                                                            <span>✕</span>
                                                                            <span>Remove from Group</span>
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Leave / Block Action */}
                        <div className="pt-2">
                            {isGroup ? (
                                <button
                                    type="button"
                                    onClick={handleLeaveGroup}
                                    disabled={isActionLoading}
                                    className="w-full px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                        />
                                    </svg>
                                    Leave Group
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startCall(partner, "audio")}
                                            className="flex-1 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <span>📞</span>
                                            <span>Audio Call</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startCall(partner, "video")}
                                            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <span>📹</span>
                                            <span>Video Call</span>
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        className="w-full px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                            />
                                        </svg>
                                        Block Contact
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
};

export default ProfilePanel;
