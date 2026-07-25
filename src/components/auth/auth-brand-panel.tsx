"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Badge } from "../ui/badge";
import { Copyright } from "../ui/copyright";

interface AuthBrandPanelProps {
    tenureName?: string | null;
}

export function AuthBrandPanel({ tenureName }: AuthBrandPanelProps) {
    return (
        <div className="relative hidden h-full w-full flex-col justify-between overflow-hidden bg-rcf-navy p-12 text-white lg:flex">
            {/* --- BACKGROUND ANIMATIONS --- */}
            <div className="absolute inset-0 z-0">
                {/* Subtle Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-rcf-navy via-[#1e1b4b] to-rcf-navy opacity-90" />

                {/* Floating Orbs */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                        rotate: [0, 45, 0],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
                />

                <motion.div
                    animate={{
                        x: [0, 30, 0],
                        y: [0, -30, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="absolute top-1/2 left-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-[100px]"
                />

                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-rcf-navy to-transparent" />
            </div>

            {/* --- CONTENT (Z-Index to sit above background) --- */}
            <div className="relative z-10 flex h-full flex-col justify-between">
                {/* Top: Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex justify-center"
                >
                    <Logo variant="white" width={140} asLink />
                </motion.div>

                {/* Middle: Quote */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1 }}
                    className="space-y-8"
                >
                    {/* Decorative Line */}
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-12 bg-rcf-gold rounded-full" />
                        <span className="text-xs font-bold text-rcf-gold tracking-widest uppercase opacity-80">
                            RCF FUTA ICT Portal
                        </span>
                    </div>

                    <div className="space-y-5">
                        <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
                            Innovating the digital
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rcf-gold to-yellow-200">
                                Fellowship Experience.
                            </span>
                        </h2>

                        <p className="text-lg font-light leading-relaxed text-gray-300">
                            We are building the digital infrastructure for the
                            next generation of believers. Seamlessly merging{" "}
                            <strong>Technology</strong> and{" "}
                            <strong>Ministry</strong> to ensure order,
                            transparency, and efficient stewardship of the fold.
                        </p>

                        {/* Tech-Ministry Hybrid Badges */}
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Badge icon="⚡" text="Digital Stewardship" />
                            <Badge icon="🌐" text="Smart Connectivity" />
                            <Badge icon="🛡️" text="Data Integrity" />
                        </div>
                    </div>
                </motion.div>

                {/* Bottom: Footer Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="flex items-center gap-4 text-xs font-medium text-gray-400"
                >
                    <Copyright tenure={tenureName} variant="light" />
                </motion.div>
            </div>
        </div>
    );
}
