"use client";

import { useEffect } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "loading" | "success" | "error";

interface ToastProps {
    open: boolean;
    type: ToastType;
    message: string;
    onClose: () => void;
}

export function Toast({ open, type, message, onClose }: ToastProps) {
    useEffect(() => {
        if (open && type !== "loading") {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [open, type, onClose]);

    const config = {
        loading: {
            icon: Loader2,
            bg: "bg-slate-900",
            text: "text-white",
            iconClass: "animate-spin text-slate-400",
        },
        success: {
            icon: CheckCircle2,
            bg: "bg-green-600",
            text: "text-white",
            iconClass: "text-white",
        },
        error: {
            icon: AlertCircle,
            bg: "bg-red-600",
            text: "text-white",
            iconClass: "text-white",
        },
    }[type];

    const Icon = config.icon;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg shadow-slate-900/10 min-w-[300px]"
                >
                    {/* Background */}
                    <div className={`absolute inset-0 rounded-xl ${config.bg} opacity-95 backdrop-blur-sm`} />

                    {/* Content */}
                    <div className="relative flex items-center gap-3 w-full">
                        <Icon className={`w-5 h-5 ${config.iconClass}`} />
                        <span className={`text-sm font-medium ${config.text} flex-1`}>
                            {message}
                        </span>
                        {type !== "loading" && (
                            <button
                                onClick={onClose}
                                className={`p-1 rounded-full hover:bg-white/20 transition-colors ${config.text}`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
