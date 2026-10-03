import React, { useContext, useRef, useState } from "react";
import { ChatContext } from "../../context/ChatContext";
import Avatar from "../common/Avatar";

const PRESET_AVATARS = [
    "👥", "🚀", "💡", "🔥", "💻", "⚡", "🎉", "🌟",
    "🎨", "☕", "🎮", "📚", "🏆", "🛡️", "🔮", "🍕"
];

export const CreateGroupModal = ({ isOpen, onClose }) => {
    const { contacts, searchUsers, createGroup } = useContext(ChatContext);

    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState("👥");
    const [selectedMembers, setSelectedMembers] = useState([]); // array of user objects
    const [memberSearch, setMemberSearch] = useState("");
    const [dbSearchResults, setDbSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const groupImgInputRef = useRef(null);

    const handleImageFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setErrorMsg("Please select an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setErrorMsg("Image size must be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            setSelectedAvatar(uploadEvent.target.result);
        };
        reader.onerror = () => {
            setErrorMsg("Failed to read image file");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    if (!isOpen) return null;

    // Search for members to add
    const handleSearchChange = async (e) => {
        const val = e.target.value;
        setMemberSearch(val);

        if (val.trim().length >= 2) {
            setSearching(true);
            try {
                const results = await searchUsers(val.trim());
                setDbSearchResults(results || []);
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setSearching(false);
            }
        } else {
            setDbSearchResults([]);
        }
    };

    // Toggle member selection
    const toggleMember = (member) => {
        const isSelected = selectedMembers.some((m) => m._id === member._id);
        if (isSelected) {
            setSelectedMembers(selectedMembers.filter((m) => m._id !== member._id));
        } else {
            setSelectedMembers([...selectedMembers, member]);
        }
    };

    // Combined candidates (Contacts + Search Results)
    const combinedCandidates = [...contacts];
    dbSearchResults.forEach((u) => {
        if (!combinedCandidates.some((c) => c._id === u._id)) {
            combinedCandidates.push(u);
        }
    });

    const filteredCandidates = memberSearch.trim()
        ? combinedCandidates.filter((u) => {
              const q = memberSearch.toLowerCase();
              return (
                  u.name?.toLowerCase().includes(q) ||
                  u.phone?.includes(memberSearch)
              );
          })
        : contacts;

    const handleCreate = async (e) => {
        e.preventDefault();
        setErrorMsg("");

        if (!groupName.trim()) {
            setErrorMsg("Please enter a group name");
            return;
        }

        if (selectedMembers.length === 0) {
            setErrorMsg("Please select at least 1 member to add");
            return;
        }

        try {
            setIsSubmitting(true);
            await createGroup({
                groupName: groupName.trim(),
                groupDescription: groupDescription.trim(),
                groupAvatar: selectedAvatar,
                participants: selectedMembers.map((m) => m._id),
            });

            // Reset and close
            setGroupName("");
            setGroupDescription("");
            setSelectedMembers([]);
            onClose();
        } catch (err) {
            console.error("Failed to create group:", err);
            setErrorMsg(err.response?.data?.message || "Failed to create group");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-[#141428] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
                            👥
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-white">
                                Create New Group
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Connect with multiple friends or teammates
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Error Banner */}
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Group Icon Selector & Group Name */}
                    <div className="flex items-start gap-4">
                        {/* Selected Icon / Avatar */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                            <div className="relative group">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-3xl shadow-lg shadow-purple-900/40 border border-white/10 overflow-hidden">
                                    {selectedAvatar ? (
                                        selectedAvatar.startsWith("http") ||
                                        selectedAvatar.startsWith("data:") ? (
                                            <img
                                                src={selectedAvatar}
                                                alt="Group"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            selectedAvatar
                                        )
                                    ) : (
                                        "👥"
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => groupImgInputRef.current?.click()}
                                    className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-semibold transition-opacity cursor-pointer"
                                >
                                    <span>📷</span>
                                    <span>Upload</span>
                                </button>
                            </div>
                            <input
                                type="file"
                                ref={groupImgInputRef}
                                onChange={handleImageFileSelect}
                                accept="image/*"
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => groupImgInputRef.current?.click()}
                                className="text-[10px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                            >
                                Upload Photo
                            </button>
                        </div>

                        {/* Name and Description Inputs */}
                        <div className="flex-1 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                                    Group Name <span className="text-purple-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="e.g. Design Team, Family ❤️"
                                    maxLength={50}
                                    className="w-full px-3.5 py-2.5 bg-[#1b1b36] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    Description <span className="text-zinc-500">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    placeholder="What is this group about?"
                                    maxLength={120}
                                    className="w-full px-3.5 py-2 bg-[#1b1b36] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Avatar Preset Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-zinc-400">
                                Or Pick An Icon
                            </label>
                            {selectedAvatar && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedAvatar("👥")}
                                    className="text-[11px] text-zinc-500 hover:text-zinc-300"
                                >
                                    Default 👥
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 p-2.5 bg-[#101024] rounded-2xl border border-white/5">
                            {PRESET_AVATARS.map((avatar) => (
                                <button
                                    key={avatar}
                                    type="button"
                                    onClick={() => setSelectedAvatar(avatar)}
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform hover:scale-110 cursor-pointer ${
                                        selectedAvatar === avatar
                                            ? "bg-purple-600/30 border border-purple-400 scale-105"
                                            : "hover:bg-white/5"
                                    }`}
                                >
                                    {avatar}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Selected Member Chips */}
                    {selectedMembers.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-zinc-300">
                                    Selected Members ({selectedMembers.length})
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMembers([])}
                                    className="text-[11px] text-zinc-400 hover:text-white"
                                >
                                    Clear all
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#101024] rounded-xl border border-white/5">
                                {selectedMembers.map((m) => (
                                    <span
                                        key={m._id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600/25 border border-purple-500/40 text-purple-200 text-xs font-medium"
                                    >
                                        <span className="truncate max-w-[120px]">{m.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleMember(m)}
                                            className="hover:text-white text-purple-400 ml-0.5 cursor-pointer font-bold"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search & Add Members */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Add Participants
                        </label>
                        <div className="relative mb-2">
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={handleSearchChange}
                                placeholder="Search by name or phone..."
                                className="w-full px-3.5 py-2 pl-9 bg-[#1b1b36] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                            />
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>

                        {/* Candidate list */}
                        <div className="max-h-48 overflow-y-auto divide-y divide-white/[0.04] rounded-2xl border border-white/5 bg-[#101024]">
                            {searching ? (
                                <div className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    Searching users...
                                </div>
                            ) : filteredCandidates.length === 0 ? (
                                <div className="p-5 text-center text-xs text-zinc-500">
                                    {memberSearch.trim()
                                        ? "No matching users found"
                                        : "No contacts yet. Type in search bar to find registered users."}
                                </div>
                            ) : (
                                filteredCandidates.map((candidate) => {
                                    const isSelected = selectedMembers.some(
                                        (m) => m._id === candidate._id
                                    );

                                    return (
                                        <div
                                            key={candidate._id}
                                            onClick={() => toggleMember(candidate)}
                                            className={`flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.03] cursor-pointer transition-colors ${
                                                isSelected ? "bg-purple-600/10" : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Avatar
                                                    src={candidate.profilePicture}
                                                    name={candidate.name}
                                                    size={34}
                                                    isOnline={candidate.isOnline}
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-zinc-200 truncate">
                                                        {candidate.name}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-500 truncate">
                                                        {candidate.phone}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Checkbox indicator */}
                                            <div
                                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                                    isSelected
                                                        ? "bg-purple-600 border-purple-500 text-white"
                                                        : "border-white/20 bg-white/5"
                                                }`}
                                            >
                                                {isSelected && (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="w-3.5 h-3.5"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Footer Submit */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !groupName.trim() || selectedMembers.length === 0}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all cursor-pointer flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Creating Group...
                                </>
                            ) : (
                                <>
                                    <span>Create Group</span>
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;
