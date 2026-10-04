import { useEffect, useRef, useState, useCallback } from "react";

export const useMobileBackHandler = ({
    selectedConversation,
    selectConversation,
    isProfilePanelOpen,
    setIsProfilePanelOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isAddContactOpen,
    setIsAddContactOpen,
    isCreateGroupOpen,
    setIsCreateGroupOpen,
    isStarredOpen,
    setIsStarredOpen,
    isVerifyEncryptionOpen,
    setIsVerifyEncryptionOpen,
    isThemeModalOpen,
    setIsThemeModalOpen,
    forwardingMessage,
    setForwardingMessage,
    activeTab,
    setActiveTab,
    selectedMessageIds,
    clearSelectedMessages,
    isSearching,
    setIsSearching,
    setSearchTerm,
}) => {
    const [showExitToast, setShowExitToast] = useState(false);
    const lastBackPressTime = useRef(0);
    const exitToastTimeout = useRef(null);

    // Keep latest state in refs so the popstate listener always has fresh values
    const stateRef = useRef({});
    stateRef.current = {
        selectedConversation,
        isProfilePanelOpen,
        isSettingsOpen,
        isAddContactOpen,
        isCreateGroupOpen,
        isStarredOpen,
        isVerifyEncryptionOpen,
        isThemeModalOpen,
        forwardingMessage,
        activeTab,
        selectedMessageIds,
        isSearching,
    };

    // Track active overlay count pushed to history
    const pushedLayersCount = useRef(0);
    // Flag to distinguish popstate-triggered closes from UI-triggered closes
    const isPopstateHandling = useRef(false);

    // Push history state whenever an overlay opens
    const pushOverlayHistory = useCallback((type) => {
        if (isPopstateHandling.current) return;
        try {
            window.history.pushState({ chatapp: "layer", type }, "");
            pushedLayersCount.current += 1;
        } catch (e) {}
    }, []);

    // Initial setup: ensure baseline history state exists
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Push baseline home state if at root
        try {
            window.history.replaceState({ chatapp: "root" }, "");
            window.history.pushState({ chatapp: "home" }, "");
        } catch (e) {}

        const handlePopState = (e) => {
            const current = stateRef.current;
            isPopstateHandling.current = true;

            // 1. Check topmost overlay modals
            if (current.forwardingMessage) {
                setForwardingMessage(null);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isVerifyEncryptionOpen) {
                setIsVerifyEncryptionOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isStarredOpen) {
                setIsStarredOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isThemeModalOpen) {
                setIsThemeModalOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isCreateGroupOpen) {
                setIsCreateGroupOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isAddContactOpen) {
                setIsAddContactOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isSettingsOpen) {
                setIsSettingsOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.selectedMessageIds && current.selectedMessageIds.length > 0) {
                // 2. Multi-select mode in chat -> cancel selection
                if (clearSelectedMessages) clearSelectedMessages();
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isSearching) {
                // 3. In-chat search -> close search bar
                if (setIsSearching) setIsSearching(false);
                if (setSearchTerm) setSearchTerm("");
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.isProfilePanelOpen) {
                // 4. Profile Panel drawer
                setIsProfilePanelOpen(false);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.selectedConversation) {
                // 5. Active conversation on mobile -> return to chat list!
                selectConversation(null);
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else if (current.activeTab && current.activeTab !== "chats") {
                // 6. Non-chats tab -> return to chats tab
                setActiveTab("chats");
                pushedLayersCount.current = Math.max(0, pushedLayersCount.current - 1);
            } else {
                // 7. At Root Home Chat List: Double back to exit
                const now = Date.now();
                if (now - lastBackPressTime.current < 2000) {
                    // Allowed exit: do not push state back, allow browser to exit
                    lastBackPressTime.current = 0;
                    setShowExitToast(false);
                    try {
                        window.history.back();
                    } catch (e) {}
                } else {
                    lastBackPressTime.current = now;
                    // Re-push home state to stay inside PWA
                    try {
                        window.history.pushState({ chatapp: "home" }, "");
                    } catch (err) {}

                    // Show exit warning toast
                    setShowExitToast(true);
                    if (exitToastTimeout.current) clearTimeout(exitToastTimeout.current);
                    exitToastTimeout.current = setTimeout(() => {
                        setShowExitToast(false);
                    }, 2000);
                }
            }

            setTimeout(() => {
                isPopstateHandling.current = false;
            }, 50);
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
            if (exitToastTimeout.current) clearTimeout(exitToastTimeout.current);
        };
    }, [
        selectConversation,
        setIsProfilePanelOpen,
        setIsSettingsOpen,
        setIsAddContactOpen,
        setIsCreateGroupOpen,
        setIsStarredOpen,
        setIsVerifyEncryptionOpen,
        setIsThemeModalOpen,
        setForwardingMessage,
        setActiveTab,
        clearSelectedMessages,
        setIsSearching,
        setSearchTerm,
    ]);

    // Watch selectedConversation opening
    const prevConversationId = useRef(null);
    useEffect(() => {
        const currentId = selectedConversation?._id;
        if (currentId && !prevConversationId.current && !isPopstateHandling.current) {
            pushOverlayHistory("chat");
        }
        prevConversationId.current = currentId;
    }, [selectedConversation, pushOverlayHistory]);

    // Watch active tab change away from 'chats'
    const prevTab = useRef("chats");
    useEffect(() => {
        if (activeTab !== "chats" && prevTab.current === "chats" && !isPopstateHandling.current) {
            pushOverlayHistory("tab");
        }
        prevTab.current = activeTab;
    }, [activeTab, pushOverlayHistory]);

    // Watch message selection mode
    const prevSelectionCount = useRef(0);
    useEffect(() => {
        const count = selectedMessageIds?.length || 0;
        if (count > 0 && prevSelectionCount.current === 0 && !isPopstateHandling.current) {
            pushOverlayHistory("selection");
        }
        prevSelectionCount.current = count;
    }, [selectedMessageIds, pushOverlayHistory]);

    // Watch in-chat search
    const prevSearching = useRef(false);
    useEffect(() => {
        if (isSearching && !prevSearching.current && !isPopstateHandling.current) {
            pushOverlayHistory("search");
        }
        prevSearching.current = isSearching;
    }, [isSearching, pushOverlayHistory]);

    // Watch modals opening
    const prevModals = useRef({});
    useEffect(() => {
        const prev = prevModals.current;
        const opened =
            (!prev.isSettingsOpen && isSettingsOpen) ||
            (!prev.isAddContactOpen && isAddContactOpen) ||
            (!prev.isCreateGroupOpen && isCreateGroupOpen) ||
            (!prev.isProfilePanelOpen && isProfilePanelOpen) ||
            (!prev.isStarredOpen && isStarredOpen) ||
            (!prev.isVerifyEncryptionOpen && isVerifyEncryptionOpen) ||
            (!prev.isThemeModalOpen && isThemeModalOpen) ||
            (!prev.forwardingMessage && forwardingMessage);

        if (opened && !isPopstateHandling.current) {
            pushOverlayHistory("modal");
        }

        prevModals.current = {
            isSettingsOpen,
            isAddContactOpen,
            isCreateGroupOpen,
            isProfilePanelOpen,
            isStarredOpen,
            isVerifyEncryptionOpen,
            isThemeModalOpen,
            forwardingMessage: Boolean(forwardingMessage),
        };
    }, [
        isSettingsOpen,
        isAddContactOpen,
        isCreateGroupOpen,
        isProfilePanelOpen,
        isStarredOpen,
        isVerifyEncryptionOpen,
        isThemeModalOpen,
        forwardingMessage,
        pushOverlayHistory,
    ]);

    // Safe UI back triggers (e.g. clicking on-screen Back button or Close (X))
    const handleUiBack = useCallback((fallbackCloseFn) => {
        if (pushedLayersCount.current > 0) {
            window.history.back();
        } else if (fallbackCloseFn) {
            fallbackCloseFn();
        }
    }, []);

    return {
        showExitToast,
        handleUiBack,
    };
};
