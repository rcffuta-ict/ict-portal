import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RcfIctClient } from '@rcffuta/ict-lib';

export async function POST() {
    try {
        const cookieStore = await cookies();
        
        // Try to sign out from Supabase first
        try {
            const rcf = RcfIctClient.fromEnv();
            await rcf.supabase.auth.signOut();
        } catch (error) {
            console.error('Supabase signOut error:', error);
            // Continue with cookie cleanup even if Supabase signOut fails
        }
        
        // Delete authentication cookies
        cookieStore.delete('sb-access-token');
        cookieStore.delete('sb-refresh-token');
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, error: 'Logout failed' },
            { status: 500 }
        );
    }
}
