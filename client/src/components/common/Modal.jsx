import React, { useEffect } from "react";

export const Modal = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    maxWidth = "max-w-xl",
}) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Dialog */}
            <div
                className={`relative w-full ${maxWidth} bg-[#121224] border border-white/10 rounded-2xl shadow-2xl shadow-purple-950/40 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]`}
            >
                {/* Header */}
                {(title || onClose) && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#16162e]">
                        <div>
                            {title && (
                                <h3 className="text-lg font-semibold text-white tracking-tight">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                                title="Close"
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
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto p-6 space-y-4 text-zinc-200">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
