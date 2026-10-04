import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import StylishAlert from "../components/common/StylishAlert";

export const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
    const [alertData, setAlertData] = useState(null);

    const showAlert = useCallback((msg, type = "info", duration = 3200) => {
        let message = "";
        let alertType = type;
        let alertDuration = duration;

        if (typeof msg === "object" && msg !== null) {
            message = msg.message || msg.text || "";
            alertType = msg.type || type;
            alertDuration = msg.duration || duration;
        } else {
            message = String(msg || "");
        }

        // Keep alert message concise and short
        if (message.length > 70) {
            message = message.substring(0, 70) + "...";
        }

        setAlertData({
            id: Date.now(),
            message,
            type: alertType,
            duration: alertDuration,
        });
    }, []);

    const closeAlert = useCallback(() => {
        setAlertData(null);
    }, []);

    // Intercept native browser alert globally so ANY alert() in the app uses StylishAlert
    useEffect(() => {
        const originalAlert = window.alert;

        window.alert = (msg) => {
            const str = String(msg || "");
            const lower = str.toLowerCase();

            let type = "info";
            if (
                lower.includes("offline") ||
                lower.includes("internet") ||
                lower.includes("connect")
            ) {
                type = "offline";
            } else if (
                lower.includes("fail") ||
                lower.includes("error") ||
                lower.includes("could not") ||
                lower.includes("denied")
            ) {
                type = "error";
            } else if (
                lower.includes("success") ||
                lower.includes("unblock") ||
                lower.includes("saved") ||
                lower.includes("updated")
            ) {
                type = "success";
            } else if (
                lower.includes("warn") ||
                lower.includes("block") ||
                lower.includes("permission")
            ) {
                type = "warning";
            }

            showAlert(str, type, 3200);
        };

        return () => {
            window.alert = originalAlert;
        };
    }, [showAlert]);

    return (
        <AlertContext.Provider value={{ showAlert, closeAlert }}>
            {children}
            {alertData && (
                <StylishAlert
                    key={alertData.id}
                    isOpen={Boolean(alertData)}
                    message={alertData.message}
                    type={alertData.type}
                    duration={alertData.duration}
                    onClose={closeAlert}
                />
            )}
        </AlertContext.Provider>
    );
};

export const useAlert = () => useContext(AlertContext);

export default AlertProvider;
