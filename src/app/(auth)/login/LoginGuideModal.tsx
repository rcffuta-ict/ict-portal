"use client";

import { useEffect } from "react";
import { IctLogo } from "@/src/components/common/IctLogo";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginGuideModal({ isOpen, onClose }: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className="login-card max-w-lg w-full relative animate-in fade-in zoom-in-95 duration-200"
                style={{ margin: 0 }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <div className="flex flex-col items-center text-center space-y-4 mb-6">
                    <IctLogo variant="white" width={100} />
                    <h2 className="text-2xl font-bold text-white mt-4">
                        How It Works
                    </h2>
                </div>

                <div className="space-y-4 text-white/80 text-sm leading-relaxed">
                    <p>
                        Welcome! To get your Raffle ID, you need to sign in
                        using your existing credentials from the{" "}
                        <strong>RCF FUTA ICT Portal</strong> (
                        <a
                            href="https://ict.rcffuta.com"
                            target="_blank"
                            className="text-blue-400 hover:underline"
                        >
                            ict.rcffuta.com
                        </a>
                        ).
                    </p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left">
                        <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <span>🔒</span> Secure Information Sourcing
                        </h3>
                        <p>
                            We securely source your information directly from
                            the ICT portal. This ensures that only verified RCF
                            FUTA members can participate and maintains fairness
                            in the Oracle selection.
                        </p>
                    </div>
                    <p>
                        Simply enter the same email (or phone number) and
                        password you use on the main portal to continue.
                    </p>
                </div>

                <button onClick={onClose} className="login-btn mt-6">
                    Got it, let's sign in!
                </button>
            </div>
        </div>
    );
}
