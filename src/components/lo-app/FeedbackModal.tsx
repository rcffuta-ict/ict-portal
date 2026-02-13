"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useEffect } from "react";

export type FeedbackType = "success" | "error" | "info";

interface FeedbackModalProps {
    open: boolean;
    onClose: () => void;
    type: FeedbackType;
    title: string;
    message: string;
    autoClose?: boolean;
}

export function FeedbackModal({
    open,
    onClose,
    type,
    title,
    message,
    autoClose = false,
}: FeedbackModalProps) {
    useEffect(() => {
        if (open && autoClose) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [open, autoClose, onClose]);

    if (!open) return null;

    const config = {
        success: {
            icon: CheckCircle2,
            bg: "bg-green-50",
            border: "border-green-100",
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
            titleColor: "text-green-900",
        },
        error: {
            icon: AlertCircle,
            bg: "bg-red-50",
            border: "border-red-100",
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            titleColor: "text-red-900",
        },
        info: {
            icon: AlertCircle,
            bg: "bg-blue-50",
            border: "border-blue-100",
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            titleColor: "text-blue-900",
        },
    }[type];

    const Icon = config.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden scale-100 opacity-100 transform transition-all">
                <div className={`p-6 ${config.bg} border-b ${config.border}`}>
                    <div className="flex items-start justify-between">
                        <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
                            <Icon className={`w-6 h-6 ${config.iconColor}`} />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-black/5 transition-colors -mr-2 -mt-2"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                    <h3 className={`text-lg font-bold ${config.titleColor} mb-2`}>
                        {title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        {message}
                    </p>
                </div>
                <div className="p-4 bg-white">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
                    >
                        {type === 'error' ? 'Close' : 'Got it'}
                    </button>
                </div>
            </div>
        </div>
    );
}
