"use client";

import { useState } from "react";
import {
    X,
    Star,
    Hash,
    BookOpen,
    MessageSquare,
    CheckCircle2,
    HelpCircle,
    Shield,
    Users,
} from "lucide-react";
import { LoLogo } from "./LoLogo";

interface LoAppInfoModalProps {
    open: boolean;
    onClose: () => void;
}

export function LoAppInfoModal({ open, onClose }: LoAppInfoModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-fade-in">
                {/* Header */}
                <div className="sticky top-0 bg-rcf-navy rounded-t-3xl px-6 py-5 flex items-center justify-between z-10">
                    <div>
                        <LoLogo size="lg" variant="dark" mode="full" />
                        <p className="text-sm text-white/60 mt-1">
                            How it works
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-6">
                    {/* What is Lo! */}
                    <section>
                        <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-rcf-gold" />
                            What is Lo!?
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            <strong>Lo!</strong> (meaning &ldquo;Behold!&rdquo;)
                            is your space to ask questions during fellowship
                            events, Bible studies, and services. It&apos;s
                            designed to encourage learning and foster
                            meaningful conversations in the RCF FUTA community.
                        </p>
                    </section>

                    <hr className="border-slate-100" />

                    {/* How to ask */}
                    <section>
                        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-rcf-navy" />
                            Asking a Question
                        </h3>
                        <div className="space-y-3">
                            <StepItem
                                number={1}
                                title="Tag an event with #"
                                description='Type # in your question to tag it to a specific event (e.g. #bible-study). This helps admins know the context.'
                            />
                            <StepItem
                                number={2}
                                title="Write your question"
                                description="Be clear and specific. Scripture references (like John 3:16) are automatically detected and highlighted."
                            />
                            <StepItem
                                number={3}
                                title="Submit"
                                description="Anyone can ask — you don't need to sign in! But signing in links your name to the question."
                            />
                        </div>
                    </section>

                    <hr className="border-slate-100" />

                    {/* Stars & Answers */}
                    <section>
                        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Star className="w-5 h-5 text-rcf-gold fill-rcf-gold" />
                            Stars &amp; Getting Answers
                        </h3>
                        <div className="p-4 rounded-2xl bg-rcf-gold/10 border border-rcf-gold/20 mb-3">
                            <p className="text-sm font-semibold text-rcf-navy mb-1">
                                ⭐ Why starring matters
                            </p>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                Only <strong>admins</strong> can answer
                                questions. When you <strong>star</strong> a
                                question, you&apos;re showing interest and
                                telling admins: &ldquo;We want this
                                answered!&rdquo; Questions with more stars get
                                prioritized.
                            </p>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <Star className="w-4 h-4 text-rcf-gold mt-0.5 shrink-0" />
                                <span>
                                    <strong>Star</strong> questions you want
                                    answered — it signals priority to admins
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Shield className="w-4 h-4 text-rcf-navy mt-0.5 shrink-0" />
                                <span>
                                    <strong>Admins</strong> review starred
                                    questions and provide answers
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                                <span>
                                    Answered questions show a{" "}
                                    <strong className="text-green-600">
                                        green badge
                                    </strong>{" "}
                                    so you can easily find them
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Users className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                <span>
                                    You must be{" "}
                                    <strong>signed in</strong> to star questions
                                </span>
                            </li>
                        </ul>
                    </section>

                    <hr className="border-slate-100" />

                    {/* Features */}
                    <section>
                        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-600" />
                            Features
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <FeatureChip
                                icon={<Hash className="w-3.5 h-3.5" />}
                                label="Event tagging"
                            />
                            <FeatureChip
                                icon={<BookOpen className="w-3.5 h-3.5" />}
                                label="Scripture detection"
                            />
                            <FeatureChip
                                icon={<Star className="w-3.5 h-3.5" />}
                                label="Star to prioritize"
                            />
                            <FeatureChip
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                label="Answered badges"
                            />
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 rounded-b-3xl border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-rcf-navy text-white text-sm font-bold rounded-xl hover:bg-rcf-navy-light transition-colors"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───

function StepItem({
    number,
    title,
    description,
}: {
    number: number;
    title: string;
    description: string;
}) {
    return (
        <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-rcf-navy text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {number}
            </div>
            <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                    {description}
                </p>
            </div>
        </div>
    );
}

function FeatureChip({
    icon,
    label,
}: {
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium">
            <span className="text-rcf-navy">{icon}</span>
            {label}
        </div>
    );
}

// ─── Trigger Button (for use in sidebar / header) ───

interface LoAppInfoButtonProps {
    onClick: () => void;
    variant?: "sidebar" | "compact";
}

export function LoAppInfoButton({
    onClick,
    variant = "sidebar",
}: LoAppInfoButtonProps) {
    if (variant === "compact") {
        return (
            <button
                onClick={onClick}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="How Lo! works"
            >
                <HelpCircle className="w-5 h-5 text-white/60 hover:text-white" />
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors group w-full text-left"
        >
            <HelpCircle className="w-5 h-5 text-slate-400 group-hover:text-rcf-navy" />
            <span className="text-sm font-medium">How Lo! works</span>
        </button>
    );
}
