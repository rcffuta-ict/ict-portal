
import { Copyright } from "@/components/ui/copyright";
import { Logo } from "@/components/ui/logo";
import { LogInIcon } from "lucide-react";
import Link from "next/link";

export default function ComingSoon() {
    const year = new Date().getFullYear();

    return (
        <div className="md:min-h-[800px] flex flex-col items-center justify-center bg-white">
            <main className="max-w-2xl w-full text-center px-6 py-24">
                <div className="flex justify-center">
                    <Logo
                        variant="colored"
                        width={140}
                        className="mx-auto mb-8"
                    />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Coming Soon
                </h1>
                <p className="text-gray-600 mb-8">
                    We are working to bring the new RCF FUTA portal online.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center align-center mx-auto">
                    <Link
                        href="/register"
                        className="flex items-center justify-center gap-2 bg-rcf-navy text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-rcf-navy-light transition-all hover:-translate-y-0.5"
                    >
                        <LogInIcon className="h-4 w-4" />
                        Register
                    </Link>
                </div>
            </main>

            
        </div>
    );
}
