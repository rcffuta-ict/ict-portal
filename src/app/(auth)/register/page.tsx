"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

import StepBio from "./steps/bio-step";
import StepAcademic from "./steps/academic-step";
import StepLocation from "./steps/location-step";
import { Logo } from "@/components/ui/logo";

export default function RegisterPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [userId, setUserId] = useState<string | null>(null);

    const nextStep = () => setCurrentStep((prev) => prev + 1);

    return (
        <div className="animate-fade-in max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex justify-center md:hidden">
                <Logo width={80} asLink />
            </div>
            <br className="md:hidden block" />

            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-rcf-navy">
                    Get Indexed
                </h1>
                <p className="text-sm text-gray-500">
                    Join the official RCF FUTA digital database.
                </p>
            </div>

            {/* Progress Stepper */}
            <div className="mb-8 flex items-center justify-between px-2">
                <StepIndicator
                    step={1}
                    current={currentStep}
                    label="Bio Data"
                />
                <div
                    className={`h-1 flex-1 rounded mx-2 transition-colors ${
                        currentStep > 1 ? "bg-rcf-navy" : "bg-gray-100"
                    }`}
                />
                <StepIndicator
                    step={2}
                    current={currentStep}
                    label="Academics"
                />
                <div
                    className={`h-1 flex-1 rounded mx-2 transition-colors ${
                        currentStep > 2 ? "bg-rcf-navy" : "bg-gray-100"
                    }`}
                />
                <StepIndicator
                    step={3}
                    current={currentStep}
                    label="Location"
                />
            </div>

            {/* Form Steps */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <StepBio
                                onSuccess={(id) => {
                                    setUserId(id);
                                    nextStep();
                                }}
                            />
                        </motion.div>
                    )}

                    {currentStep === 2 && userId && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <StepAcademic
                                userId={userId}
                                onSuccess={nextStep}
                            />
                        </motion.div>
                    )}

                    {currentStep === 3 && userId && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <StepLocation userId={userId} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link
                    href="/login"
                    className="font-semibold text-rcf-navy hover:underline"
                >
                    Log in
                </Link>
            </div>
        </div>
    );
}

// Helper for the circles at the top
function StepIndicator({ step, current, label }: any) {
    const isCompleted = current > step;
    const isActive = current === step;

    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className={`
        flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all
        ${
            isCompleted
                ? "bg-green-500 text-white"
                : isActive
                ? "bg-rcf-navy text-white ring-4 ring-blue-50"
                : "bg-gray-100 text-gray-400"
        }
      `}
            >
                {isCompleted ? <Check className="h-4 w-4" /> : step}
            </div>
            <span
                className={`text-[10px] font-medium uppercase tracking-wider ${
                    isActive ? "text-rcf-navy" : "text-gray-400"
                }`}
            >
                {label}
            </span>
        </div>
    );
}
