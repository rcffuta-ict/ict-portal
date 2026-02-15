"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  Repeat,
  Lock,
  ArrowRight,
  Tag,
  Settings2
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Event } from "@/app/events/page";

interface EventCardProps {
  event: Event;
  index: number;
  isAdmin: boolean;
  onEdit: (event: Event) => void;
}

export function EventCard({ event, index, isAdmin, onEdit }: EventCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group h-full"
    >
      <div className="bg-white rounded-4xl border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-500 overflow-hidden h-full flex flex-col relative">
        <div className="p-8 pb-4 flex-1">
          {/* Date Indicator & Title Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500 shrink-0">
              <span className="text-xs font-black uppercase tracking-widest opacity-60 group-hover:opacity-80">
                {format(new Date(event.date), "MMM")}
              </span>
              <span className="text-xl font-black">
                {format(new Date(event.date), "dd")}
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Tag className="w-3 h-3 text-blue-500" />
                {event.slug}
              </div>
              <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors duration-300 line-clamp-1">
                {event.title}
              </h3>
            </div>
          </div>

          {/* Nicely displayed status badges under title */}
          <div className="flex flex-wrap gap-2 mb-6">
            {event.is_active && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg shadow-green-500/20">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Live Now
              </span>
            )}
            {event.is_exclusive && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg shadow-indigo-600/20">
                <Lock className="w-3 h-3" />
                Exclusive
              </span>
            )}
            {event.is_recurring && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg shadow-amber-500/20">
                <Repeat className="w-3 h-3" />
                Recurring
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 mb-8 font-medium italic">
              &ldquo;{event.description}&rdquo;
            </p>
          )}

          {/* Metadata */}
          <div className="space-y-4 mb-4">
            <div className="flex items-center gap-3 text-sm text-slate-900 font-bold">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <CalendarDays className="h-4 w-4" />
              </div>
              {format(new Date(event.date), "MMMM do, yyyy")}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0 mt-auto">
          <div className="p-2 bg-slate-50 rounded-2xl flex items-center justify-between gap-2">
            <Link
              href={`/events/${event.slug}`}
              className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-black text-sm hover:bg-slate-900 hover:text-white transition-all shadow-sm flex-1 justify-center whitespace-nowrap"
            >
              View Details
              <ArrowRight className="h-4 w-4" />
            </Link>

            {isAdmin && (
              <button
                onClick={() => onEdit(event)}
                className="p-3 text-slate-400 hover:text-blue-600 transition-colors bg-white rounded-xl shadow-sm border border-slate-100"
                title="Edit Event"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
