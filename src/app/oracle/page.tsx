"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/src/lib/supabase/client";
import toast from "react-hot-toast";
import OracleSlotMachine from "@/src/components/OracleSlotMachine";

interface SelectedPerson {
    firstName: string;
    lastName: string;
    level: string;
    unit: string | null;
}

export default function OraclePage() {
    const [raffleId, setRaffleId] = useState<number | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [person, setPerson] = useState<SelectedPerson | null>(null);
    const channelRef = useRef<ReturnType<
        ReturnType<typeof createBrowserClient>["channel"]
    > | null>(null);

    useEffect(() => {
        const supabase = createBrowserClient();
        const channel = supabase.channel("oracle-channel");
        channelRef.current = channel;

        channel
            .on("broadcast", { event: "preparing" }, () => {
                setRaffleId(null);
                setPerson(null);
                setSpinning(true);
                toast.loading("Oracle is choosing…", { id: "oracle" });
            })
            .on("broadcast", { event: "selection" }, ({ payload }: any) => {
                const id = Number(payload.raffleId);
                if (!id) return;
                setRaffleId(id);
                setSpinning(false);
                toast.success("Oracle has decided!", { id: "oracle" });
            })
            .on(
                "broadcast",
                { event: "selection:details:show" },
                ({ payload }: any) => {
                    setPerson(payload);
                },
            )
            .on("broadcast", { event: "reset" }, () => {
                setRaffleId(null);
                setPerson(null);
                setSpinning(false);
                toast.dismiss("oracle");
            })
            .subscribe((status) => {
                if (status === "SUBSCRIBED")
                    toast.success("Oracle is live!", { duration: 2000 });
            });

        return () => {
            supabase.removeChannel(channel);
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
                <OracleSlotMachine value={raffleId} isSpinning={spinning} />
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
                                {person.level} Level
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
