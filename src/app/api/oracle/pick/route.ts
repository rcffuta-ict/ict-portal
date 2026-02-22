import { NextRequest, NextResponse } from "next/server";
import { getOracleStore, emitOracleEvent, addPickHistory } from "@/src/lib/oracleStore";

export async function POST(request: NextRequest) {
    const isAdmin = true;
    if (!isAdmin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { level, gender, spinTime } = await request.json();

    const store = getOracleStore();

    if (store.registrations.length === 0) {
        return NextResponse.json(
            { error: "No registrations loaded. Please sync data first." },
            { status: 400 }
        );
    }

    let candidates = store.registrations;

    if (level) candidates = candidates.filter(r => r.level.includes(level));
    if (gender) candidates = candidates.filter(r => r.gender === gender);

    if (candidates.length === 0) {
        return NextResponse.json(
            { error: "No eligible registrants found for that filter." },
            { status: 404 }
        );
    }

    // Filter out recently picked if possible
    let eligibleCandidates = candidates.filter(c => !store.pickedHistory.includes(c.raffle_id));
    
    // If filtering out recents leaves no one, ignore the cooldown
    if (eligibleCandidates.length === 0) {
        eligibleCandidates = candidates;
    }

    // Pick a random winner
    const winner = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];

    const picked = {
        raffleId: winner.raffle_id,
        firstName: winner.first_name,
        lastName: winner.last_name,
        level: winner.level,
        gender: winner.gender,
        unit: winner.unit,
    };

    addPickHistory(winner.raffle_id);

    // Send total spin duration to frontend
    const delay = spinTime ? Number(spinTime) * 1000 : 3000;
    
    // Broadcast "preparing" → oracle TV clears
    emitOracleEvent("preparing", {});
    
    // Immediately tell the frontend to start the selection process visually
    emitOracleEvent("selection", { 
        raffleId: winner.raffle_id,
        spinDuration: delay
    });

    return NextResponse.json({ success: true, data: picked });
}
