export interface OracleRegistration {
    id: string;
    raffle_id: number;
    first_name: string;
    last_name: string;
    level: string;
    gender: string;
    email: string;
    unit: string | null;
}

export interface OracleState {
    registrations: OracleRegistration[];
    pickedHistory: number[];
    clients: Set<ReadableStreamDefaultController<any>>;
}

// Global state for persistence across Next.js dev reloads
declare global {
    var __oracleStore: OracleState | undefined;
}

if (!global.__oracleStore) {
    global.__oracleStore = {
        registrations: [],
        pickedHistory: [],
        clients: new Set(),
    };
}

export const getOracleStore = () => global.__oracleStore!;

export function emitOracleEvent(event: string, payload?: any) {
    const store = getOracleStore();
    const data = JSON.stringify({ event, payload: payload || {} });
    const message = `data: ${data}\n\n`;

    const deadClients = new Set<ReadableStreamDefaultController<any>>();

    store.clients.forEach((client) => {
        try {
            client.enqueue(new TextEncoder().encode(message));
        } catch (err) {
            deadClients.add(client);
        }
    });

    deadClients.forEach((client) => store.clients.delete(client));
}

export function addPickHistory(raffleId: number) {
    const store = getOracleStore();
    store.pickedHistory.push(raffleId);
    if (store.pickedHistory.length > 3) {
        store.pickedHistory.shift();
    }
}
