"use client";

import {
  TrendingUp,
  Link2,
  Users,
  MessageCircle,
} from "lucide-react";
import { TabType } from "../types";

interface TabNavigationProps {
  activeTab: TabType;
  setTab: (tab: TabType) => void;
}

const tabs = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "links", label: "Links", icon: Link2 },
  { id: "attendees", label: "Attendees", icon: Users },
  { id: "questions", label: "Questions", icon: MessageCircle },
] as const;

export default function TabNavigation({ activeTab, setTab }: TabNavigationProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex gap-1 sm:gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as TabType)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base ${
              activeTab === t.id
                ? "bg-teal-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}