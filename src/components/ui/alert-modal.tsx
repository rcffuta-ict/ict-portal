"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertModalProps {
    isOpen: boolean;
    /**
     * After a confirm, called with the id of the alert that was confirmed, so
     * useAlertModal can ignore it when that confirm has already opened a new alert.
     */
    onClose: (confirmedAlertId?: number) => void;
    title?: string;
    message: string;
    type?: AlertType;
    confirmText?: string;
    /** Label shown on the confirm button while an async `onConfirm` runs. */
    pendingText?: string;
    onConfirm?: () => void;
    /**
     * Which alert this is. Set by useAlertModal's showAlert; lets the modal tell that an
     * `onConfirm` opened a NEW alert (a success or error message) rather than finishing.
     */
    alertId?: number;
    /**
     * Extra controls rendered under the message — a checkbox that changes what the
     * confirm does, for instance. Kept optional so every existing caller is unaffected.
     */
    children?: React.ReactNode;
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    children,
    type = "info",
    confirmText = "OK",
    pendingText = "Working…",
    onConfirm,
    alertId,
}: AlertModalProps) {
    /**
     * True while an async `onConfirm` is still running. The modal stays open and fully
     * locked down until it settles: on a slow phone connection the old behaviour left a
     * live Confirm button with no feedback, so a second tap fired the action twice.
     */
    const [pending, setPending] = useState(false);

    // A reopened modal must never inherit the previous confirm's pending state.
    useEffect(() => {
        if (!isOpen) setPending(false);
    }, [isOpen]);

    /** Dismissals (Escape, backdrop, X, Cancel) are ignored while the action is in flight. */
    const requestClose = () => {
        if (pending) return;
        onClose();
    };

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !pending) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose, pending]);

    const handleConfirm = async () => {
        if (pending) return;
        const confirming = alertId;
        if (onConfirm) {
            setPending(true);
            try {
                await onConfirm();
            } catch (error) {
                console.error("Error in onConfirm callback:", error);
            } finally {
                setPending(false);
            }
        }
        // Most confirms report back by opening another alert ("Done", or the error).
        // Closing unconditionally here shut that report the instant it opened, so a
        // failure looked exactly like nothing happening. The hook closes only if the
        // confirmed alert is still the one showing.
        onClose(confirming);
    };

    const config = {
        success: {
            icon: CheckCircle2,
            iconColor: "text-green-500",
            bgColor: "bg-green-50",
            borderColor: "border-green-200",
            titleColor: "text-green-900",
            defaultTitle: "Success",
        },
        error: {
            icon: AlertCircle,
            iconColor: "text-red-500",
            bgColor: "bg-red-50",
            borderColor: "border-red-200",
            titleColor: "text-red-900",
            defaultTitle: "Error",
        },
        warning: {
            icon: AlertTriangle,
            iconColor: "text-yellow-500",
            bgColor: "bg-yellow-50",
            borderColor: "border-yellow-200",
            titleColor: "text-yellow-900",
            defaultTitle: "Warning",
        },
        info: {
            icon: Info,
            iconColor: "text-blue-500",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-200",
            titleColor: "text-blue-900",
            defaultTitle: "Information",
        },
    };

    const { icon: Icon, iconColor, bgColor, borderColor, titleColor, defaultTitle } = config[type];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop. Above every other modal (they sit at z-50 to z-[150]):
                    an alert is usually raised FROM one, and at the same z-index the one
                    later in the DOM wins, which put confirmations behind their form.
                    Still below the toast and preview banner (z-[200]). */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={requestClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[160] flex items-center justify-center p-4 min-h-screen"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            aria-busy={pending}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            {/* Header with Icon */}
                            <div
                                className={`${bgColor} ${borderColor} border-b p-6 relative`}
                            >
                                <button
                                    onClick={requestClose}
                                    type="button"
                                    disabled={pending}
                                    aria-label="Close"
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-start gap-4">
                                    <div className={`${iconColor} shrink-0`}>
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <h3
                                            className={`text-lg font-semibold ${titleColor}`}
                                        >
                                            {title || defaultTitle}
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6">
                                <p className="text-gray-700 leading-relaxed">
                                    {message}
                                </p>
                                {children && <div className="mt-4">{children}</div>}
                            </div>

                            {/* Footer */}
                            <div className="px-6 pb-6 flex justify-end gap-3">
                                {onConfirm && (
                                    <button
                                        onClick={requestClose}
                                        type="button"
                                        disabled={pending}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    type="button"
                                    disabled={pending}
                                    aria-busy={pending}
                                    className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-all hover:shadow-lg disabled:cursor-wait disabled:opacity-80 disabled:hover:shadow-none ${
                                        type === "error"
                                            ? "bg-red-500 hover:bg-red-600"
                                            : type === "success"
                                                ? "bg-green-500 hover:bg-green-600"
                                                : type === "warning"
                                                    ? "bg-yellow-500 hover:bg-yellow-600"
                                                    : "bg-rcf-navy hover:bg-blue-800"
                                    }`}
                                >
                                    {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                    {pending ? pendingText : confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Simple hook for managing alert state
export function useAlertModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [alertConfig, setAlertConfig] = useState<Omit<AlertModalProps, "isOpen" | "onClose">>({
        message: "",
        type: "info",
    });

    const nextId = useRef(0);

    const showAlert = (config: Omit<AlertModalProps, "isOpen" | "onClose" | "alertId">) => {
        nextId.current += 1;
        setAlertConfig({ ...config, alertId: nextId.current });
        setIsOpen(true);
    };

    /** With an id (after a confirm): close only if that alert is still the current one. */
    const closeAlert = (confirmedAlertId?: number) => {
        if (confirmedAlertId !== undefined && confirmedAlertId !== nextId.current) return;
        setIsOpen(false);
    };

    return {
        isOpen,
        alertConfig,
        showAlert,
        closeAlert,
    };
}
