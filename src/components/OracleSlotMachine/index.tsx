"use client";

import { useEffect, useRef, useState } from "react";

const SPIN_DURATION_BASE = 3000; // ms per reel, from left
const REEL_DELAY = 1000; // each subsequent reel delayed by this

interface ReelProps {
    targetDigit: number | null;
    delay: number;
    isSpinning: boolean;
}

function Reel({ targetDigit, delay, isSpinning }: ReelProps) {
    const [settled, setSettled] = useState(false);
    const [displayDigit, setDisplayDigit] = useState<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const animRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (animRef.current) clearInterval(animRef.current);

        if (targetDigit === null) {
            setSettled(false);
            setDisplayDigit(0);
            return;
        }

        setSettled(false);

        // Fast-roll random digits while spinning toward target
        animRef.current = setInterval(() => {
            setDisplayDigit(Math.floor(Math.random() * 10));
        }, 80);

        timerRef.current = setTimeout(() => {
            clearInterval(animRef.current!);
            setDisplayDigit(targetDigit);
            setSettled(true);
        }, delay);

        return () => {
            clearTimeout(timerRef.current!);
            clearInterval(animRef.current!);
        };
    }, [targetDigit, delay]);

    const isRolling = !settled && (isSpinning || targetDigit !== null);

    return (
        <div
            className={`oracle-reel ${isRolling ? "oracle-reel--rolling" : ""} ${settled ? "oracle-reel--settled" : ""}`}
        >
            <span className="oracle-reel__digit">
                {targetDigit === null && !isSpinning ? "?" : displayDigit}
            </span>
        </div>
    );
}

function getDigit(value: number | null, position: number): number | null {
    if (value === null) return null;
    const s = String(value).padStart(5, "0");
    return parseInt(s[position], 10);
}

interface Props {
    value: number | null;
    isSpinning: boolean;
}

export default function OracleSlotMachine({ value, isSpinning }: Props) {
    return (
        <div className="oracle-slot-machine">
            {[0, 1, 2, 3, 4].map((pos) => (
                <Reel
                    key={pos}
                    targetDigit={getDigit(value, pos)}
                    delay={SPIN_DURATION_BASE + pos * REEL_DELAY}
                    isSpinning={isSpinning}
                />
            ))}
        </div>
    );
}
