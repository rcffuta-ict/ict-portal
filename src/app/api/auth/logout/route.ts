import { NextResponse } from 'next/server';
import { revokeCurrentSession } from '@/lib/auth/session';

export async function POST() {
    try {
        // Revoking the session fires the DB audit trigger (logs the 'logout' event).
        await revokeCurrentSession();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, error: 'Logout failed' },
            { status: 500 }
        );
    }
}
