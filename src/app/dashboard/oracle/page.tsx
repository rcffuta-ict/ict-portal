import { ShieldAlert, Database } from "lucide-react";
import { runOracleQuery, getOracleRefData } from "./actions";
import { DEFAULT_COLUMNS } from "./fields";
import { OracleClient } from "./components/oracle-client";

/**
 * Oracle — the System Admin's view of everybody in the fellowship.
 *
 * Query anyone across every field the app holds, then open a record to correct it.
 * Guarded inside the actions themselves (`requirePresidentOrSysAdmin` to read,
 * `requireSysAdmin` to write); an unauthorized visitor gets the notice below rather
 * than a redirect, matching how Settings behaves.
 *
 * The first page of results is rendered on the SERVER, so the screen arrives complete
 * instead of flashing an empty table while a client fetch runs.
 */
export default async function OraclePage() {
    const [refs, first] = await Promise.all([
        getOracleRefData(),
        runOracleQuery({
            conditions: [],
            match: "all",
            columns: DEFAULT_COLUMNS,
            page: 1,
            pageSize: 25,
        }),
    ]);

    if (!refs.success) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted area</h1>
                <p className="text-sm text-gray-600">
                    Only the System Admin can open the Oracle.
                </p>
            </div>
        );
    }

    const refData = {
        zones: refs.zones.map((z: { id: string; name: string }) => ({ id: z.id, label: z.name })),
        classSets: refs.classSets.map((c: { id: string; family_name: string | null; entry_year: number | null }) => ({
            id: c.id,
            label: c.family_name || `${c.entry_year ?? "Unknown"} set`,
        })),
        units: refs.units.map((u: { id: string; name: string; type: string }) => ({
            id: u.id,
            // Units and teams share one picker, so the kind has to be visible in the label.
            label: `${u.name}${u.type === "TEAM" ? " (team)" : ""}`,
        })),
    };

    return (
        <div className="space-y-6">
            <header className="flex items-start gap-3">
                <div className="inline-flex rounded-lg bg-rcf-navy p-3 text-white">
                    <Database className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">Oracle</h1>
                    <p className="max-w-2xl text-sm text-gray-500">
                        Everybody in the fellowship, in one place. Build a question out of
                        conditions, choose the columns you care about, then open a record to
                        correct it. Every edit is logged.
                    </p>
                </div>
            </header>

            <OracleClient
                refData={refData}
                initial={{
                    rows: first.success ? first.rows : [],
                    columns: first.success ? first.columns : DEFAULT_COLUMNS,
                    total: first.success ? first.total : 0,
                    error: first.success ? undefined : first.error,
                }}
            />
        </div>
    );
}

// Always fresh: this page reads live member data, and a cached copy of the roster is
// both stale and a leak waiting to happen.
export const dynamic = "force-dynamic";
