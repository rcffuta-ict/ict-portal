import { RcfIctClient } from "@rcffuta/ict-lib/server";

// Use RcfIctClient.asAdmin() to get the service-role Supabase client.
// This avoids re-instantiating Supabase directly on the server.
export const getAdminClient = () => RcfIctClient.asAdmin().supabase;

// Regular (anon-key) client via ict-lib
export const getClient = () => RcfIctClient.fromEnv().supabase;

/**
 * Broadcast an event to the oracle Supabase Realtime channel from the server.
 * Uses the admin client (service role) so it can always publish.
 */
export async function broadcastOracleEvent(
    event: string,
    payload: Record<string, unknown>
) {
    const supabase = getAdminClient();
    const channel = supabase.channel("oracle-channel");

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Broadcast timeout")), 5000);
        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                clearTimeout(timer);
                resolve();
            }
            if (status === "CHANNEL_ERROR") {
                clearTimeout(timer);
                reject(new Error("Channel error"));
            }
        });
    });

    await channel.send({ type: "broadcast", event, payload });
    await supabase.removeChannel(channel);
}
