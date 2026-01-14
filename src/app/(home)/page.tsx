
import { Logo } from "@/components/ui/logo";
import { LogInIcon, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";

export default function ComingSoon() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-rcf-navy/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
            </div>

            <main className="relative max-w-3xl w-full text-center px-6 py-16">
                {/* Logo */}
                <div className="flex justify-center mb-8 animate-fade-in">
                    <Logo
                        variant="colored"
                        width={160}
                        className="mx-auto drop-shadow-lg"
                    />
                </div>

                {/* Main heading */}
                <div className="mb-8 animate-fade-in space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-rcf-navy rounded-full text-sm font-semibold mb-4">
                        <Sparkles className="h-4 w-4" />
                        Portal Update in Progress
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        We&apos;re Currently Recuperating
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        The RCF FUTA ICT Portal is undergoing maintenance and improvements. 
                        We&apos;re working hard to bring you a better experience!
                    </p>
                </div>

                {/* Info card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100 animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        New Member? You Can Still Register!
                    </h2>
                    <p className="text-gray-600 mb-6">
                        While we&apos;re improving the portal, new members can go ahead and register. 
                        Create your account and you&apos;ll be ready when we&apos;re back online.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/register"
                            className="group flex items-center justify-center gap-2 bg-rcf-navy text-white px-8 py-4 rounded-xl font-bold text-base shadow-lg hover:bg-rcf-navy-light transition-all hover:-translate-y-1 hover:shadow-xl"
                        >
                            <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Register Now
                        </Link>

                        <Link
                            href="/login"
                            className="group flex items-center justify-center gap-2 bg-white text-rcf-navy border-2 border-rcf-navy px-8 py-4 rounded-xl font-bold text-base hover:bg-rcf-navy hover:text-white transition-all hover:-translate-y-1 hover:shadow-lg"
                        >
                            <LogInIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Login
                        </Link>
                    </div>
                </div>

                {/* Additional info */}
                <div className="text-sm text-gray-500 space-y-2 animate-fade-in">
                    <p>Already have an account? Login to access your dashboard.</p>
                    <p className="text-xs">
                        Questions? Contact the ICT Team at <span className="font-semibold text-rcf-navy">ict@rcffuta.com</span>
                    </p>
                </div>
            </main>
        </div>
    );
}
