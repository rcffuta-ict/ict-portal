import { ShieldAlert, Settings as SettingsIcon } from "lucide-react";
import { getSettingsData } from "./actions";
import { ModuleAccessEditor } from "./components/module-access-editor";

/**
 * App Settings — the System Admin configures who can read/write each Tool module, app-wide,
 * by privilege tag, scoped tag, or leadership-position slug. Readable by the President
 * (read-only). Guarded server-side inside getSettingsData; others get an access notice.
 */
export default async function SettingsPage() {
    const data = await getSettingsData();

    if (!data.authorized || !data.config) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted area</h1>
                <p className="text-sm text-gray-600">
                    Only the System Admin can manage app access settings.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start gap-3">
                <div className="inline-flex rounded-lg bg-rcf-navy p-3 text-white">
                    <SettingsIcon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">
                        App Settings
                    </h1>
                    <p className="max-w-2xl text-sm text-gray-500">
                        Control who can read and write each Tool module. Grant access by a{" "}
                        <span className="font-medium">privilege tag</span> (e.g. all CENTRAL
                        positions), a <span className="font-medium">scoped tag</span> (e.g.{" "}
                        <span className="font-mono">Exco:bible-study</span>), or a{" "}
                        <span className="font-medium">position slug</span> (only whoever holds
                        that position). Admins always have full access.
                    </p>
                </div>
            </header>

            <ModuleAccessEditor
                config={data.config}
                positions={data.positions ?? []}
                units={data.units ?? []}
                canWrite={data.canWrite ?? false}
            />
        </div>
    );
}
