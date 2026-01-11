import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { Copyright } from "@/components/ui/copyright";
import { RcfIctClient } from "@rcffuta/ict-lib";

async function getActiveTenureName() {
    const rcf = RcfIctClient.fromEnv();

    try {
        const { data } = await rcf.supabase
            .from("tenures")
            .select("name")
            .eq("is_active", true)
            .single();

        return data?.name || null;
    } catch (error) {
        return null; // Fallback if no tenure exists
    }
}


export default async function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const tenureName = await getActiveTenureName();
    return (
        <div className="min-h-screen w-full lg:grid lg:grid-cols-3 overflow-hidden bg-slate-50">
            {/* Left Side - Extracted to Client Component for Animation */}
            <div className="hidden lg:block lg:col-span-1 h-full shadow-2xl relative z-10">
                <AuthBrandPanel tenureName={tenureName} />
            </div>

            {/* Right Side - Form Area */}
            <div className="relative flex items-center justify-center px-4 py-8 md:p-12 lg:col-span-2">
                {/* Background Pattern (Dot Grid) */}
                <div
                    className="absolute inset-0 z-0 opacity-40"
                    style={{
                        backgroundImage:
                            "radial-gradient(#cbd5e1 1px, transparent 1px)",
                        backgroundSize: "32px 32px",
                    }}
                />

                {/* Decorative Blur Top Right */}
                <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-100 blur-3xl opacity-50 z-0" />

                {/* Decorative Blur Bottom Left */}
                <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pink-100 blur-3xl opacity-50 z-0" />

                {/* Form Container */}
                <div className="relative z-10 w-full max-w-3xl space-y-6">
                    {children}

                    <footer className="flex justify-center text-center md:hidden">
                        <Copyright tenure={tenureName} variant="dark"/>
                    </footer>
                </div>
            </div>
        </div>
    );
}
