import React, { useContext, useState } from "react";
import { ChatContext } from "../../context/ChatContext";
import Modal from "../common/Modal";

export const AddContactModal = ({ isOpen, onClose }) => {
    const { addContact } = useContext(ChatContext);
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!phone.trim()) {
            setError("Please enter a phone number.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            await addContact(phone.trim(), name.trim());
            setPhone("");
            setName("");
            onClose();
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to add contact."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add New Contact"
            subtitle="Connect with friends and colleagues on ChatApp"
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Phone Number <span className="text-purple-400">*</span>
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit phone number"
                        pattern="[0-9]{10}"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#181830] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Display Name <span className="text-zinc-500">(Optional)</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#181830] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                        {error}
                    </div>
                )}

                <div className="pt-2 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !phone.trim()}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
                    >
                        {loading && (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        {loading ? "Adding..." : "Add Contact"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddContactModal;
