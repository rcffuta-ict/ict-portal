"use client";

import { Heart, RefreshCcw } from "lucide-react";

interface HeaderProps {
  loading: boolean;
  loadData: () => void;
}

export default function Header({ loading, loadData }: HeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-linear-to-br from-teal-500 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-white fill-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-amber-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Agape &apos;26 Admin</h1>
            <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">Singles Weekend Management</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/20 shrink-0 text-sm sm:text-base"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}