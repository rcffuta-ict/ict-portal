"use client";

import { motion } from "framer-motion";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { LinkItem, ColorClasses } from "../types";

interface LinksTabProps {
  copiedId: string | null;
  copyToClipboard: (linkId: string, text: string) => void;
  getColorClasses: (color: string) => ColorClasses;
  LINKS: LinkItem[];
}

export default function LinksTab({
  copiedId,
  copyToClipboard,
  getColorClasses,
  LINKS,
}: LinksTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100">
            <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
          </div>
          Event Links
        </h2>
        <p className="text-slate-500 mb-4 sm:mb-6 text-sm sm:text-base">
          Copy and share these links with attendees, vendors, and team members.
        </p>

        <div className="space-y-3 sm:space-y-4">
          {LINKS.map((link) => {
            const colors = getColorClasses(link.color);
            const fullUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}${link.path}`
                : link.path;

            return (
              <div
                key={link.id}
                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl ${colors.bg} border ${colors.border} transition-all hover:shadow-md`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${colors.iconBg} w-fit`}>
                    <link.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-900 font-semibold text-base sm:text-lg">{link.title}</h3>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">{link.description}</p>
                    <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-white/70 rounded-lg p-2 border border-slate-200">
                      <code className="text-xs text-slate-600 flex-1 truncate">
                        {fullUrl}
                      </code>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(link.id, `${link.shareText}\n${fullUrl}`)
                          }
                          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg ${colors.iconBg} ${colors.text} text-xs sm:text-sm font-medium hover:opacity-80 transition-opacity`}
                        >
                          {copiedId === link.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={link.path}
                          target="_blank"
                          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium hover:bg-slate-200 transition-colors`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          Open
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}