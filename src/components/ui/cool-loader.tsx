"use client";

import { motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";

interface CoolLoaderProps {
    message?: string;
    subMessage?: string;
}

export function CoolLoader({ 
    message = "Loading...", 
    subMessage 
}: CoolLoaderProps) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                {/* Animated Icon Container */}
                <div className="relative">
                    {/* Outer Rotating Ring */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-linear-to-tr from-rcf-navy via-blue-600 to-purple-600 opacity-20"
                        animate={{
                            rotate: 360,
                            scale: [1, 1.1, 1],
                        }}
                        transition={{
                            rotate: {
                                duration: 3,
                                repeat: Infinity,
                                ease: "linear",
                            },
                            scale: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            },
                        }}
                        style={{ width: "120px", height: "120px" }}
                    />

                    {/* Inner Pulsing Circle */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-linear-to-br from-blue-500 to-purple-600 opacity-30 blur-xl"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.5, 0.3],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{ width: "120px", height: "120px" }}
                    />

                    {/* Center Icon */}
                    <motion.div
                        className="relative flex items-center justify-center rounded-full bg-linear-to-br from-rcf-navy to-blue-700 shadow-lg"
                        animate={{
                            y: [0, -8, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{ width: "120px", height: "120px" }}
                    >
                        <Crown className="w-12 h-12 text-white" />
                        
                        {/* Sparkles */}
                        <motion.div
                            className="absolute -top-2 -right-2"
                            animate={{
                                scale: [0, 1, 0],
                                rotate: [0, 180, 360],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        >
                            <Sparkles className="w-6 h-6 text-yellow-400" />
                        </motion.div>

                        <motion.div
                            className="absolute -bottom-2 -left-2"
                            animate={{
                                scale: [0, 1, 0],
                                rotate: [0, -180, -360],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 1,
                            }}
                        >
                            <Sparkles className="w-5 h-5 text-blue-300" />
                        </motion.div>
                    </motion.div>
                </div>

                {/* Loading Text */}
                <div className="text-center space-y-2 mt-8">
                    <motion.h3
                        className="text-xl font-semibold text-rcf-navy"
                        animate={{
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        {message}
                    </motion.h3>
                    {subMessage && (
                        <p className="text-sm text-gray-500">{subMessage}</p>
                    )}
                </div>

                {/* Loading Dots */}
                <div className="flex gap-2">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-3 h-3 rounded-full bg-rcf-navy"
                            animate={{
                                y: [0, -12, 0],
                                opacity: [0.3, 1, 0.3],
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.2,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
