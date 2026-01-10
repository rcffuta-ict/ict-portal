
import { Logo } from "@/components/ui/logo";

export default function ComingSoon() {
    const year = new Date().getFullYear();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            <main className="max-w-2xl w-full text-center px-6 py-24">
                <div className="flex justify-center">
                    <Logo variant="colored" width={140} className="mx-auto mb-8" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Coming Soon</h1>
                <p className="text-gray-600 mb-8">
                    We are working to bring the new RCF FUTA portal online.
                </p>
            </main>

            <footer className="w-full text-center py-6">
                <p className="text-sm text-gray-500">© {year} RCFFUTA ICT Team. All rights reserved.</p>
            </footer>
        </div>
    );
}
