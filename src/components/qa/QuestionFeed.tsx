"use client";

import { type Question } from "./QAPageClient";
import { QuestionCard } from "./QuestionCard";

interface QuestionFeedProps {
    questions: Question[];
    isAdmin: boolean;
    onAnswer: (id: string, text: string) => Promise<void>;
    onToggleVisibility: (id: string, status: "visible" | "hidden") => Promise<void>;
}

export function QuestionFeed({
    questions,
    isAdmin,
    onAnswer,
    onToggleVisibility,
}: QuestionFeedProps) {
    return (
        <div>
            {questions.map((question, index) => (
                <QuestionCard
                    key={question.id}
                    question={question}
                    isAdmin={isAdmin}
                    onAnswer={onAnswer}
                    onToggleVisibility={onToggleVisibility}
                    animationDelay={Math.min(index * 30, 300)}
                />
            ))}
        </div>
    );
}
