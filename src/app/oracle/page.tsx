"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import OracleSlotMachine from "@/src/components/OracleSlotMachine";
import { displayLevelBetter } from "@/src/lib/utils";

interface SelectedPerson {
    firstName: string;
    lastName: string;
    level: string;
    unit: string | null;
    gender: string;
}

export default function OraclePage() {
    const [raffleId, setRaffleId] = useState<number | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [spinDuration, setSpinDuration] = useState<number>(3000);
    const [person, setPerson] = useState<SelectedPerson | null>(null);

    useEffect(() => {
        const eventSource = new EventSource("/api/oracle/stream");

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const { event: eventName, payload } = data;

            if (eventName === "ping") {
                toast.success("Oracle is live!", {
                    duration: 2000,
                    id: "oracle-live",
                });
            } else if (eventName === "preparing") {
                setRaffleId(null);
                setPerson(null);
                setSpinning(true);
                toast.loading("Oracle is choosing…", { id: "oracle" });
            } else if (eventName === "selection") {
                const id = Number(payload.raffleId);
                const duration = Number(payload.spinDuration) || 3000;
                if (!id) return;

                setSpinDuration(duration);
                setRaffleId(id);
                setSpinning(false);

                // Delay the success toast until the slot machine fully settles
                setTimeout(() => {
                    toast.success("Oracle has decided!", { id: "oracle" });
                }, duration);
            } else if (eventName === "selection:details:show") {
                setPerson(payload);
            } else if (eventName === "reset") {
                setRaffleId(null);
                setPerson(null);
                setSpinning(false);
                toast.dismiss("oracle");
            }
        };

        eventSource.onerror = (error) => {
            console.error("SSE Error:", error);
            // EventSource auto-reconnects on error
        };

        return () => {
            eventSource.close();
        };
    }, []);

    return (
        <div className="oracle-page">
            {/* Ambient glows */}
            <div className="oracle-glow oracle-glow--purple" />
            <div className="oracle-glow oracle-glow--blue" />

            {/* Header */}
            <div className="oracle-header">
                <div className="oracle-header__eyebrow">RCF FUTA</div>
                <h1 className="oracle-header__title">
                    <span className="text-gradient">ORACLE</span>
                </h1>
                <p className="oracle-header__tagline">
                    Never Forget. Never Bias.
                </p>
            </div>

            {/* Slot machine */}
            <div className="oracle-machine-wrap">
                <OracleSlotMachine
                    value={raffleId}
                    isSpinning={spinning}
                    spinDuration={spinDuration}
                />
            </div>

            {/* Stand-by state */}
            {!raffleId && !spinning && (
                <p className="oracle-standby">
                    Waiting for Oracle to activate…
                </p>
            )}

            {/* Grand reveal overlay */}
            {person && (
                <div className="oracle-reveal">
                    <div className="oracle-reveal__card">
                        <div className="oracle-reveal__glow" />
                        <p className="oracle-reveal__congrats">
                            🎉 Congratulations!
                        </p>
                        <h2 className="oracle-reveal__name">
                            {person.firstName} {person.lastName}
                        </h2>
                        <div className="oracle-reveal__badges">
                            <span className="oracle-badge oracle-badge--level">
                                {person.gender === "male"
                                    ? "Brother"
                                    : "Sister"}
                            </span>
                            <span className="oracle-badge oracle-badge--level">
                                {displayLevelBetter(person.level)}
                            </span>
                            {person.unit && (
                                <span className="oracle-badge oracle-badge--unit">
                                    {person.unit}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
