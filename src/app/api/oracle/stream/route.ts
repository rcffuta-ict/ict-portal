import { NextRequest } from "next/server";
import { getOracleStore } from "@/src/lib/oracleStore";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const store = getOracleStore();

    let controller: ReadableStreamDefaultController<any>;
    const stream = new ReadableStream({
        start(c) {
            controller = c;
            store.clients.add(controller);
            
            // Send initial ping
            try {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ event: 'ping' })}\n\n`));
            } catch (err) {
                store.clients.delete(controller);
            }
        },
        cancel() {
            if (controller) {
                store.clients.delete(controller);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
