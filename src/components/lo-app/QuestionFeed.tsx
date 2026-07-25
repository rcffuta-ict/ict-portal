"use client";

import { QuestionCard } from "./QuestionCard";
import type { Question, LoEvent } from "./LoAppClient";

interface QuestionFeedProps {
    questions: Question[];
    isAdmin: boolean;
    onAnswer: (id: string, text: string) => void;
    onToggleVisibility: (id: string, status: "visible" | "hidden") => void;
    starCounts: Record<string, number>;
    userStars: string[];
    onToggleStar: (id: string) => void;
    isAuthenticated: boolean;
    events: LoEvent[];
}

export function QuestionFeed({
    questions,
    isAdmin,
    onAnswer,
    onToggleVisibility,
    starCounts,
    userStars,
    onToggleStar,
    isAuthenticated,
    events,
}: QuestionFeedProps) {
    return (
        <div>
            {questions.map((question, i) => (
                <QuestionCard
                    key={question.id}
                    question={question}
                    isAdmin={isAdmin}
                    onAnswer={onAnswer}
                    onToggleVisibility={onToggleVisibility}
                    starCount={starCounts[question.id] || 0}
                    isStarred={userStars.includes(question.id)}
                    onToggleStar={onToggleStar}
                    isAuthenticated={isAuthenticated}
                    events={events}
                    index={i}
                />
            ))}
        </div>
    );
}
