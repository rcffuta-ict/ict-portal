"use client";

import { motion } from "framer-motion";
import {
  Users,
  Heart,
  CheckCircle2,
  UserMinus,
  Ticket,
  Link2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { StatsData, LinkItem, ColorClasses } from "../types";

interface OverviewTabProps {
  data: StatsData | null;
  copiedId: string | null;
  copyToClipboard: (linkId: string, text: string) => void;
  getRelationshipStatusDisplayName: (status: string) => string;
  getColorClasses: (color: string) => ColorClasses;
  LINKS: LinkItem[];
}

export default function OverviewTab({
  data,
  copiedId,
  copyToClipboard,
  getRelationshipStatusDisplayName,
  getColorClasses,
  LINKS,
}: OverviewTabProps) {
  const couponsGenerated = data?.coupons?.generated || 0;
  const couponsActive = data?.registrants?.filter((r) => r.coupon_active).length || 0;
  const couponsRedeemed = data?.coupons?.redeemed || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          {
            label: "Total Registered",
            value: data?.totalRegistered || 0,
            icon: Users,
            color: "from-purple-500 to-purple-600",
            bgLight: "bg-purple-50",
          },
          {
            label: "Checked In",
            value: data?.checkedIn || 0,
            icon: CheckCircle2,
            color: "from-green-500 to-green-600",
            bgLight: "bg-green-50",
          },
          {
            label: "Brothers",
            value: data?.brothers || 0,
            icon: Users,
            color: "from-blue-500 to-blue-600",
            bgLight: "bg-blue-50",
          },
          {
            label: "Sisters",
            value: data?.sisters || 0,
            icon: Heart,
            color: "from-pink-500 to-pink-600",
            bgLight: "bg-pink-50",
          },
          {
            label: "RCF Members",
            value: data?.rcfMembers || 0,
            icon: Users,
            color: "from-teal-500 to-teal-600",
            bgLight: "bg-teal-50",
          },
          {
            label: "Guests",
            value: data?.guests || 0,
            icon: UserMinus,
            color: "from-orange-500 to-orange-600",
            bgLight: "bg-orange-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bgLight} rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-white shadow-sm`}
          >
            <div
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-linear-to-br ${stat.color} flex items-center justify-center mb-2 sm:mb-3 shadow-lg`}
            >
              <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-slate-500 text-xs sm:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        {/* Coupon Stats */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            Coupon Statistics
          </h3>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center py-1.5 sm:py-2">
              <span className="text-slate-600 text-sm sm:text-base">Total Generated</span>
              <span className="text-slate-900 font-semibold">{couponsGenerated}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 sm:py-2">
              <span className="text-slate-600 text-sm sm:text-base">Active (Unused)</span>
              <span className="text-green-600 font-semibold">{couponsActive}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 sm:py-2">
              <span className="text-slate-600 text-sm sm:text-base">Redeemed</span>
              <span className="text-amber-600 font-semibold">{couponsRedeemed}</span>
            </div>
            <div className="pt-2 sm:pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm sm:text-base">Redemption Rate</span>
                <span className="text-teal-600 font-semibold">
                  {couponsGenerated > 0
                    ? ((couponsRedeemed / couponsGenerated) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Relationship Status Breakdown */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-pink-100">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600" />
            </div>
            Relationship Status
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {Object.entries(data?.relationshipStatus || {}).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center py-1.5 sm:py-2">
                <span className="text-slate-600 text-sm sm:text-base">
                  {getRelationshipStatusDisplayName(status)}
                </span>
                <span className="text-slate-900 font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(data?.relationshipStatus || {}).length === 0 && (
              <p className="text-slate-400 text-sm italic">No relationship status data available</p>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100">
              <Link2 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
            </div>
            Quick Links
          </h3>
          <div className="space-y-2">
            {LINKS.slice(0, 4).map((link) => {
              const colors = getColorClasses(link.color);
              return (
                <div
                  key={link.id}
                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl ${colors.bg} border ${colors.border}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${colors.iconBg} shrink-0`}>
                      <link.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${colors.text}`} />
                    </div>
                    <span className="text-slate-900 text-xs sm:text-sm font-medium truncate">{link.title}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          link.id,
                          `${window.location.origin}${link.path}`
                        )
                      }
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      {copiedId === link.id ? (
                        <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                      ) : (
                        <Copy className={`w-3 h-3 sm:w-4 sm:h-4 ${colors.text}`} />
                      )}
                    </button>
                    <a
                      href={link.path}
                      target="_blank"
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <ExternalLink className={`w-3 h-3 sm:w-4 sm:h-4 ${colors.text}`} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
