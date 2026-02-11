"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  CheckCircle2,
  Search,
  Download,
  UserMinus,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { StatsData, RegistrantType } from "../types";

interface AttendeesTabProps {
  data: StatsData | null;
  search: string;
  setSearch: (search: string) => void;
  filteredAttendees: RegistrantType[];
  expandedRows: Set<string>;
  toggleRowExpansion: (attendeeId: string) => void;
  getRelationshipStatusBadgeClass: (status: string) => string;
  getRelationshipStatusDisplayName: (status: string) => string;
  handleExportCSV: () => void;
}

export default function AttendeesTab({
  data,
  search,
  setSearch,
  filteredAttendees,
  expandedRows,
  toggleRowExpansion,
  getRelationshipStatusBadgeClass,
  getRelationshipStatusDisplayName,
  handleExportCSV,
}: AttendeesTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or coupon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
          />
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20 text-sm sm:text-base"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Attendees Table */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-8">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Name & Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Gender & Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Relationship Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Membership
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Check-in Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Coupon
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No attendees found
                  </td>
                </tr>
              ) : (
                filteredAttendees.map((attendee) => (
                  <React.Fragment key={attendee.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRowExpansion(attendee.id)}
                          className="p-1 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          {expandedRows.has(attendee.id) ? (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-slate-900 font-medium">
                            {attendee.first_name} {attendee.last_name}
                          </p>
                          <p className="text-slate-600 text-sm">{attendee.email}</p>
                          <p className="text-slate-400 text-xs">{attendee.phone_number}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              attendee.gender?.toLowerCase() === "male"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-pink-100 text-pink-700"
                            }`}
                          >
                            {attendee.gender?.toLowerCase() === "male" ? "Brother" : "Sister"}
                          </span>
                          <p className="text-slate-700 text-sm">{attendee.level}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {attendee.relationship_status ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRelationshipStatusBadgeClass(
                              attendee.relationship_status
                            )}`}
                          >
                            {getRelationshipStatusDisplayName(attendee.relationship_status)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {attendee.is_rcf_member ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                              RCF Member
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <UserMinus className="w-3 h-3" />
                              Guest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {attendee.checked_in_at ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Checked In
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {attendee.coupon_code ? (
                          <div className="space-y-1">
                            <code className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {attendee.coupon_code}
                            </code>
                            {attendee.coupon_used_at ? (
                              <p className="text-xs text-amber-600 font-medium">Redeemed</p>
                            ) : attendee.coupon_active ? (
                              <p className="text-xs text-green-600 font-medium">Active</p>
                            ) : (
                              <p className="text-xs text-slate-400">Inactive</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                    {/* Expanded Row */}
                    {expandedRows.has(attendee.id) && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <MessageCircle className="w-4 h-4 text-slate-600" />
                              Questions & Comments
                            </h4>
                            {attendee.questions_content ? (
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {attendee.questions_content}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400 italic">No questions or comments provided.</p>
                            )}
                            
                            {/* Additional Details */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                  Registration Details
                                </h5>
                                <div className="text-sm space-y-1">
                                  <p><span className="text-slate-600">Email:</span> <span className="text-slate-900">{attendee.email}</span></p>
                                  <p><span className="text-slate-600">Phone:</span> <span className="text-slate-900">{attendee.phone_number}</span></p>
                                  <p><span className="text-slate-600">Gender:</span> <span className="text-slate-900">{attendee.gender}</span></p>
                                  <p><span className="text-slate-600">Level:</span> <span className="text-slate-900">{attendee.level || 'Not specified'}</span></p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                  Status Information
                                </h5>
                                <div className="text-sm space-y-1">
                                  <p><span className="text-slate-600">Relationship Status:</span> <span className="text-slate-900">{getRelationshipStatusDisplayName(attendee.relationship_status || "")}</span></p>
                                  <p><span className="text-slate-600">RCF Member:</span> <span className="text-slate-900">{attendee.is_rcf_member ? 'Yes' : 'No (Guest)'}</span></p>
                                  <p><span className="text-slate-600">Check-in Status:</span> 
                                    <span className={`ml-1 ${attendee.checked_in_at ? 'text-green-600' : 'text-slate-500'}`}>
                                      {attendee.checked_in_at ? `Checked in at ${new Date(attendee.checked_in_at).toLocaleString()}` : 'Not checked in'}
                                    </span>
                                  </p>
                                  {attendee.coupon_used_at && (
                                    <p><span className="text-slate-600">Coupon Used:</span> 
                                      <span className="text-amber-600 ml-1">{new Date(attendee.coupon_used_at).toLocaleString()}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-slate-500 text-sm text-center">
        Showing {filteredAttendees.length} of {data?.registrants?.length || 0} attendees
      </p>
    </motion.div>
  );
}