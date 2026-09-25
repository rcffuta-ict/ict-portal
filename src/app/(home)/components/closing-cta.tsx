import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";

export function ClosingCta() {
    return (
        <section aria-labelledby="cta-title" className="bg-white px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
            <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-linear-to-br from-rcf-navy via-rcf-navy to-rcf-navy-light px-6 py-14 text-center text-white shadow-2xl shadow-rcf-navy/25 sm:px-12 sm:py-20">
                <div aria-hidden="true" className="absolute inset-0 -z-10">
                    <div className="absolute -top-24 left-1/2 h-48 w-[40rem] -translate-x-1/2 rounded-full bg-rcf-gold/10 blur-3xl" />
                </div>
                <h2 id="cta-title" className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
                    Your place in the family is{" "}
                    <span className="font-display font-normal italic text-rcf-gold">one step away.</span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
                    New to RCF FUTA? Register as a member. Already serving? Sign in and pick up where
                    your unit left off.
                </p>
                <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                    <Link
                        href="/profile"
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rcf-gold px-7 text-base font-bold text-rcf-navy shadow-xl shadow-black/25 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rcf-navy"
                    >
                        Register as a member <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                    >
                        <LogIn className="h-4 w-4" aria-hidden="true" /> Leader sign-in
                    </Link>
                </div>
            </div>
        </section>
    );
}
