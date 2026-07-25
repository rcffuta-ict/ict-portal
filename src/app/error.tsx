"use client";

import { useEffect, useState } from "react";
// import { Geist, Geist_Mono } from "next/font/google";
import {
    RefreshCcw,
    Home,
    AlertOctagon,
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    Terminal,
} from "lucide-react";
// import "./globals.css"; // Import CSS so Tailwind works

// // 1. Load Fonts Locally (Since Root Layout might be broken)
// const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// const geistMono = Geist_Mono({
//     variable: "--font-geist-mono",
//     subsets: ["latin"],
// });

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
    const [copied, setCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    // Development check
    const isDev = process.env.NODE_ENV === "development";

    useEffect(() => {
        console.error("Global Error Caught:", error);
    }, [error]);

    const handleCopy = () => {
        const text = `Error: ${error.message}\nDigest: ${error.digest}\nStack: ${error.stack}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Pattern */}
            <div
                className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                style={{
                    backgroundImage:
                        "radial-gradient(#cbd5e1 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            />

            {/* Main Card */}
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                {/* Header Stripe */}
                <div className="h-2 w-full bg-gradient-to-r from-red-500 via-rcf-navy to-red-500" />

                <div className="p-8 md:p-12 text-center">
                    {/* Icon */}
                    <div className="mx-auto mb-6 h-20 w-20 bg-red-50 rounded-full flex items-center justify-center border border-red-100 shadow-inner">
                        <AlertOctagon className="h-10 w-10 text-red-600" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
                        System Critical
                    </h1>

                    <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
                        The portal encountered an unexpected condition.
                        <br className="hidden sm:block" />
                        Our ICT team has been notified.
                    </p>

                    {/* Error Digest (The ID you give to devs) */}
                    {error.digest && (
                        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-mono text-slate-500">
                            <span className="font-bold text-slate-700">
                                Reference ID:
                            </span>
                            <span className="select-all">{error.digest}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => reset()}
                            className="flex items-center justify-center gap-2 bg-rcf-navy text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 hover:bg-[#2a2257] hover:-translate-y-0.5 transition-all"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Reload System
                        </button>

                        <button
                            onClick={() => (window.location.href = "/")}
                            className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
                        >
                            <Home className="h-4 w-4" />
                            Return Home
                        </button>
                    </div>
                </div>

                {/* Technical Details Accordion (Visible in Dev or if toggled) */}
                <div className="border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full px-8 py-4 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-100 transition-colors"
                    >
                        <span>Technical Details</span>
                        {showDetails ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>

                    {showDetails && (
                        <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-2">
                            <div className="bg-slate-900 rounded-xl p-4 text-left relative group overflow-hidden">
                                {/* Copy Button */}
                                <button
                                    onClick={handleCopy}
                                    className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                                    title="Copy Error Log"
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-400" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </button>

                                <div className="font-mono text-xs text-red-300 mb-2 flex items-center gap-2">
                                    <Terminal className="h-4 w-4" />
                                    <span>{error.name || "Error"}</span>
                                </div>

                                <p className="font-mono text-sm text-slate-300 mb-4 border-b border-white/10 pb-4">
                                    {error.message}
                                </p>

                                <div className="overflow-x-auto">
                                    <pre className="text-[10px] leading-relaxed text-slate-500 font-mono">
                                        {error.stack ||
                                            "No stack trace available."}
                                    </pre>
                                </div>
                            </div>

                            {isDev && (
                                <p className="text-center text-xs text-orange-600 mt-4 font-medium">
                                    ⚠ You are viewing this in Development Mode
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center space-y-2">
                <p className="text-sm font-medium text-slate-900">
                    RCF FUTA ICT Team
                </p>
                {/* <p className="text-xs text-slate-400">
                            System Version 2.0 • Rebranding Tenure
                        </p> */}
            </div>
        </div>
    );
}
