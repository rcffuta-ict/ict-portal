"use client";

import { Heart, Globe, Shield, Sparkles, MessageSquare, Ticket, Home, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Copyright } from "@/components/ui/copyright";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveTenureName } from "@/utils/action";
import { LoLogo } from "../lo-app/LoLogo";
import { Logo } from "../ui/logo";

export function SinglesWeekendFooter() {
    return (
        <div className="text-center py-8 text-sm text-slate-400">
            <p>Brought to you by the Singles Weekend committee • Powered by RCFFUTA ICT Team</p>
            <p className="mt-2">❤️ Agape &lsquo;26 - Singles Weekend</p>
        </div>
    );
}

export function GenericFooter() {
    const currentYear = new Date().getFullYear();
    const [tenure, setTenure] = useState<string | null>(null);

    useEffect(() => {
        getActiveTenureName().then(setTenure);
    }, []);

    const footerLinks = [
        { name: "Events", href: "/events", icon: Ticket },
        { name: "Portal Home", href: "/", icon: Home },
        // { name: "Lo! App", href: "/lo-app", icon: LoLogo },
    ];

    return (
        <footer className="w-full py-20 px-6 border-t border-slate-200/60 bg-white/40 backdrop-blur-md relative overflow-hidden shrink-0">
            {/* Background Accents */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-50/50 rounded-full blur-[120px] -mt-48 pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-50/50 rounded-full blur-[120px] -mb-48 pointer-events-none" />

            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-16 md:gap-8 items-start">
                    {/* Brand Column */}
                    <div className="md:col-span-5 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="space-y-6"
                        >
                            <div className="flex items-center gap-3">
                                <Logo width={60} asLink/>
                                <div>
                                    <h4 className="text-md font-black text-slate-900 tracking-tight leading-none">RCF FUTA</h4>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">ICT Portal</span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-500 leading-relaxed font-medium max-w-sm italic">
                                &quot;Advancing the Kingdom through Excellence & Innovation. Our digital infrastructure is built to support the spiritual growth and community engagement of every member.&quot;
                            </p>

                        </motion.div>
                    </div>

                    {/* Quick Access Column */}
                    <div className="md:col-span-3 space-y-8">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quick Access</h5>
                        <ul className="space-y-4">
                            {footerLinks.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="group flex items-center gap-3 text-sm font-bold text-slate-600 hover:text-blue-600 transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <link.icon className="w-4 h-4" />
                                        </div>
                                        {link.name}
                                    </Link>
                                </li>
                            ))}

                            <Link
                                href={"/lo-app"}
                                className="group flex items-center gap-3 text-sm font-bold text-slate-600 hover:text-blue-600 transition-all"
                            >
                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    <LoLogo mode="short" size="sm" variant="light"/>
                                </div>
                                Visit Lo! App
                            </Link>
                        </ul>
                    </div>

                    {/* Community Column */}
                    <div className="md:col-span-4 space-y-8">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Our Community</h5>
                        <div className="p-6 bg-slate-900 rounded-4xl text-white shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10 space-y-4">
                                <p className="text-xs font-bold text-slate-400 leading-relaxed">
                                    Stay connected with the central hub for the latest updates and spiritual resources.
                                </p>
                                <a
                                    href="https://rcffuta.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Visit Main Website <ArrowUpRight className="w-3 h-3" />
                                </a>
                            </div>
                            <Globe className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 group-hover:rotate-12 transition-transform duration-700" />
                        </div>
                    </div>
                </div>

                {/* Bottom Legal Section */}
                <div className="mt-20 pt-10 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8">
                    <Copyright tenure={tenure} variant="dark" />
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                        Laborers Together With God
                    </div>
                </div>
            </div>
        </footer>
    );
}
