"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";

const LEVELS = ["100", "200", "300", "400", "500", "All"];
const GENDERS = [
    { label: "Brother", value: "male" },
    { label: "Sister", value: "female" },
    { label: "Both", value: "Both" },
];
const SPIN_TIMES = [1, 3, 5, 10];

interface PickedPerson {
    raffleId: number;
    firstName: string;
    lastName: string;
    level: string;
    unit: string | null;
    gender: string;
}

export default function OracleController() {
    const [level, setLevel] = useState("All");
    const [gender, setGender] = useState("Both");
    const [spinTime, setSpinTime] = useState(3);
    const [picked, setPicked] = useState<PickedPerson | null>(null);
    const [isPending, startTransition] = useTransition();

    const [isSyncing, startSyncing] = useTransition();

    function handleSync() {
        startSyncing(async () => {
            const toastId = toast.loading("Syncing registered members...");
            try {
                const res = await fetch("/api/oracle/sync", { method: "POST" });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.error || "Failed to sync", {
                        id: toastId,
                    });
                    return;
                }
                toast.success(
                    `Synced ${json.count} registrants successfully!`,
                    { id: toastId },
                );
            } catch (err) {
                toast.error("Network error while syncing", { id: toastId });
            }
        });
    }

    function handleRoll() {
        startTransition(async () => {
            const toastId = toast.loading("Oracle is choosing…");
            try {
                const res = await fetch("/api/oracle/pick", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        level: level === "All" ? null : level,
                        gender: gender === "Both" ? null : gender,
                        spinTime,
                    }),
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.error || "Failed to pick winner", {
                        id: toastId,
                    });
                    return;
                }
                toast.success(`Oracle picked Raffle #${json.data.raffleId}!`, {
                    id: toastId,
                });
                setPicked(json.data);
            } catch (err) {
                toast.error("Network error", { id: toastId });
            }
        });
    }

    function handleShowPerson() {
        if (!picked) return;
        fetch("/api/oracle/show", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person: picked }),
        });
        toast.success("Revealing person on screen…");
    }

    function handleReset() {
        setPicked(null);
        fetch("/api/oracle/reset", { method: "POST" });
        toast("Oracle reset.", { icon: "🔄" });
    }

    return (
        <div className="controller-page">
            <div className="controller-glow controller-glow--purple" />
            <div className="controller-glow controller-glow--blue" />

            <div className="controller-card">
                {/* Header */}
                <div className="controller-header">
                    <h1 className="controller-title">
                        <span className="text-gradient">Oracle</span> Controller
                    </h1>
                    <p className="controller-sub">Admin Remote</p>
                </div>

                {/* Level filter */}
                <div className="controller-group">
                    <label className="controller-group__label">Level</label>
                    <div className="filter-pills">
                        {LEVELS.map((l) => (
                            <button
                                key={l}
                                className={`filter-pill ${level === l ? "filter-pill--active" : ""}`}
                                onClick={() => setLevel(l)}
                                disabled={isPending}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Gender filter */}
                <div className="controller-group">
                    <label className="controller-group__label">Gender</label>
                    <div className="filter-pills">
                        {GENDERS.map((g) => (
                            <button
                                key={g.value}
                                className={`filter-pill ${gender === g.value ? "filter-pill--active" : ""}`}
                                onClick={() => setGender(g.value)}
                                disabled={isPending}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Spin Duration */}
                <div className="controller-group">
                    <label className="controller-group__label">
                        Spin Duration
                    </label>
                    <div className="filter-pills">
                        {SPIN_TIMES.map((t) => (
                            <button
                                key={t}
                                className={`filter-pill ${spinTime === t ? "filter-pill--active" : ""}`}
                                onClick={() => setSpinTime(t)}
                                disabled={isPending || isSyncing}
                            >
                                {t}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="controller-actions">
                    <button
                        className="ctrl-btn ctrl-btn--primary"
                        onClick={handleRoll}
                        disabled={isPending || isSyncing}
                    >
                        {isPending ? (
                            <span className="ctrl-btn__spinner" />
                        ) : (
                            "🎰 Roll It"
                        )}
                    </button>

                    <button
                        className="ctrl-btn ctrl-btn--secondary"
                        onClick={handleShowPerson}
                        disabled={!picked || isPending || isSyncing}
                    >
                        👁 Show Person
                    </button>

                    <button
                        className="ctrl-btn ctrl-btn--reset"
                        onClick={handleReset}
                        disabled={isPending || isSyncing}
                    >
                        🔄 Reset
                    </button>

                    <button
                        className="ctrl-btn ctrl-btn--secondary"
                        style={{ marginTop: "1rem" }}
                        onClick={handleSync}
                        disabled={isPending || isSyncing}
                    >
                        {isSyncing ? "Syncing..." : "🔄 Update Registrations"}
                    </button>
                </div>

                {/* Picked person preview */}
                {picked && (
                    <div className="controller-result">
                        <div className="controller-result__raffle">
                            #{picked.raffleId}
                        </div>
                        <div className="controller-result__name">
                            {picked.firstName} {picked.lastName}
                        </div>
                        <div className="controller-result__meta">
                            {picked.level} Level
                            {picked.unit && ` · ${picked.unit}`}
                            {" · "}
                            {picked.gender === "male" ? "Brother" : "Sister"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
