"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    type?: AlertType;
    confirmText?: string;
    onConfirm?: () => void;
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = "info",
    confirmText = "OK",
    onConfirm,
}: AlertModalProps) {
    
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        onClose();
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
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            {/* Header with Icon */}
                            <div className={`${bgColor} ${borderColor} border-b p-6 relative`}>
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                
                                <div className="flex items-start gap-4">
                                    <div className={`${iconColor} shrink-0`}>
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <h3 className={`text-lg font-semibold ${titleColor}`}>
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
                            </div>

                            {/* Footer */}
                            <div className="px-6 pb-6 flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className={`px-6 py-2 rounded-lg text-white font-medium transition-all hover:shadow-lg ${
                                        type === "error" 
                                            ? "bg-red-500 hover:bg-red-600" 
                                            : type === "success"
                                            ? "bg-green-500 hover:bg-green-600"
                                            : type === "warning"
                                            ? "bg-yellow-500 hover:bg-yellow-600"
                                            : "bg-rcf-navy hover:bg-blue-800"
                                    }`}
                                >
                                    {confirmText}
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

    const showAlert = (config: Omit<AlertModalProps, "isOpen" | "onClose">) => {
        setAlertConfig(config);
        setIsOpen(true);
    };

    const closeAlert = () => {
        setIsOpen(false);
    };

    return {
        isOpen,
        alertConfig,
        showAlert,
        closeAlert,
    };
}
