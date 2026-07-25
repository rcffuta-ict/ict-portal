"use client";

import { Menu, X } from "lucide-react";
import { Logo } from "../ui/logo";

interface MobileHeaderProps {
    onMenuClick: () => void;
    isMenuOpen: boolean;
}

export function MobileHeader({ onMenuClick, isMenuOpen }: MobileHeaderProps) {
    return (
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
            <div className="flex items-center gap-2 py-20">
                <Logo variant="colored" width={50} />
            </div>
            <button 
                onClick={onMenuClick}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
            >
                {isMenuOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    <Menu className="h-6 w-6" />
                )}
            </button>
        </header>
    );
}
