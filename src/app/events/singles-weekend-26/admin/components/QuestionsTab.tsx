"use client";

import { formatDistanceToNow } from "date-fns";
import {
    Search,
    X,
    Mail,
    Phone,
    MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    BadgeGroup,
    CountBadge,
    FilterBadge,
    MembershipBadge,
    GenderBadge,
    StatusBadge
} from "@/components/ui/badge-group";
import { RegistrantType } from "../types";

interface QuestionsTabProps {
  questionsData: RegistrantType[];
  filteredQuestions: RegistrantType[];
  paginatedQuestions: RegistrantType[];
  questionsSearch: string;
  setQuestionsSearch: (search: string) => void;
  questionsFilter: string;
  setQuestionsFilter: (filter: string) => void;
  questionsSortBy: 'newest' | 'oldest' | 'longest' | 'shortest' | 'name';
  setQuestionsSortBy: (sort: 'newest' | 'oldest' | 'longest' | 'shortest' | 'name') => void;
  currentQuestionsPage: number;
  setCurrentQuestionsPage: (page: number) => void;
  questionsPerPage: number;
  setQuestionsPerPage: (perPage: number) => void;
}

export default function QuestionsTab({
    questionsData,
    filteredQuestions,
    paginatedQuestions,
    questionsSearch,
    setQuestionsSearch,
    questionsFilter,
    setQuestionsFilter,
    questionsSortBy,
    setQuestionsSortBy,
    currentQuestionsPage,
    setCurrentQuestionsPage,
    questionsPerPage,
    setQuestionsPerPage,
}: QuestionsTabProps) {
    return (
        <div className="space-y-6">
            {/* Header with stats and controls */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-lg font-semibold text-gray-900">
              Questions & Comments
                        </h3>
                        <BadgeGroup spacing="normal">
                            <CountBadge
                                count={filteredQuestions.length}
                                label={`of ${questionsData.length}`}
                            />
                            <FilterBadge
                                isActive={!!questionsSearch}
                                label="Filtered"
                                onClear={() => setQuestionsSearch('')}
                            />
                        </BadgeGroup>
                    </div>

                    {/* Search and filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search questions, names, emails..."
                                value={questionsSearch}
                                onChange={(e) => setQuestionsSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-64"
                            />
                            {questionsSearch && (
                                <button
                                    onClick={() => setQuestionsSearch('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Filter dropdown */}
                        <select
                            value={questionsFilter}
                            onChange={(e) => setQuestionsFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Questions</option>
                            <option value="long">Long Questions (100+ chars)</option>
                            <option value="short">Short Questions (&lt;100 chars)</option>
                            <option value="checked_in">Checked In Only</option>
                            <option value="male">Male Attendees</option>
                            <option value="female">Female Attendees</option>
                            <option value="members">RCF Members</option>
                            <option value="guests">Guests</option>
                        </select>

                        {/* Sort dropdown */}
                        <select
                            value={questionsSortBy}
                            onChange={(e) => setQuestionsSortBy(e.target.value as 'newest' | 'oldest' | 'longest' | 'shortest' | 'name')}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="longest">Longest First</option>
                            <option value="shortest">Shortest First</option>
                            <option value="name">By Name</option>
                        </select>
                    </div>
                </div>

                {/* Quick stats */}
                {questionsData.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                            <div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {questionsData.filter(q => (q.questions_content?.length || 0) >= 100).length}
                                </div>
                                <div className="text-xs text-gray-500">Long Questions</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {questionsData.filter(q => q.checked_in_at).length}
                                </div>
                                <div className="text-xs text-gray-500">Checked In</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {Math.round(questionsData.reduce((acc, q) => acc + (q.questions_content?.length || 0), 0) / questionsData.length)}
                                </div>
                                <div className="text-xs text-gray-500">Avg. Length</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {questionsData.filter(q => !q.is_rcf_member).length}
                                </div>
                                <div className="text-xs text-gray-500">From Guests</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Questions list */}
            <div className="space-y-4">
                {paginatedQuestions.length > 0 ? (
                    <>
                        {paginatedQuestions.map((registrant: RegistrantType, index: number) => (
                            <div key={registrant.id} className="relative">
                                {/* Thread connection line */}
                                {index < paginatedQuestions.length - 1 && (
                                    <div
                                        className="absolute left-6 top-16 w-px bg-gray-200"
                                        style={{ height: 'calc(100% - 2rem)' }}
                                    />
                                )}

                                <div className="flex space-x-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                                    {/* Avatar and thread indicator */}
                                    <div className="shrink-0 relative">
                                        {/* <div className="w-12 h-12 bg-linear-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-sm font-semibold text-blue-700">
                        {registrant.first_name?.[0]?.toUpperCase()}{registrant.last_name?.[0]?.toUpperCase()}
                      </span>
                    </div> */}

                                        {/* Thread connection dot */}
                                        {index > 0 && (
                                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-300 rounded-full" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                                <h4 className="font-semibold text-gray-900">
                                                    {registrant.first_name} {registrant.last_name}
                                                </h4>

                                                {/* Status badges */}
                                                <BadgeGroup spacing="tight" className="mt-1 sm:mt-0">
                                                    <MembershipBadge isMember={registrant.is_rcf_member} />

                                                    {registrant.checked_in_at && (
                                                        <StatusBadge status="Checked In" variant="success" />
                                                    )}

                                                    {registrant.gender && (
                                                        <GenderBadge gender={registrant.gender} />
                                                    )}
                                                </BadgeGroup>
                                            </div>

                                            <time className="text-xs text-gray-500 whitespace-nowrap">
                                                {formatDistanceToNow(new Date(registrant.created_at || ''), { addSuffix: true })}
                                            </time>
                                        </div>

                                        {/* Question content */}
                                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-200 mb-3">
                                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                {registrant.questions_content}
                                            </p>
                                        </div>

                                        {/* Footer with contact info */}
                                        <div className="flex flex-wrap md:items-center text-xs text-gray-500 gap-x-4 gap-y-1">
                                            <span className="flex items-center space-x-1">
                                                <Mail size={12} />
                                                <span className="truncate max-w-48">{registrant.email}</span>
                                            </span>

                                            {registrant.phone_number && (
                                                <>
                                                <span className="text-gray-400">•</span>
                                                    <span className="flex items-center space-x-1">
                                                        <Phone size={12} />
                                                        <span>{registrant.phone_number}</span>
                                                    </span>

                                                    {/* <span className="text-gray-400">•</span> */}
                                                </>
                                            )}
                                            {/* <span className="text-gray-400">•</span> */}
                                            {/* <span>{registrant.questions_content?.length || 0} characters</span> */}
                                            {/* <span className="text-gray-400">•</span> */}
                                            {/* <span>Position #{(currentQuestionsPage - 1) * questionsPerPage + index + 1}</span> */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Pagination controls */}
                        {filteredQuestions.length > questionsPerPage && (
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    {/* Page info */}
                                    <div className="text-sm text-gray-700">
                    Showing {((currentQuestionsPage - 1) * questionsPerPage) + 1} to {Math.min(currentQuestionsPage * questionsPerPage, filteredQuestions.length)} of {filteredQuestions.length} questions
                                    </div>

                                    {/* Pagination buttons */}
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setCurrentQuestionsPage(1)}
                                            disabled={currentQuestionsPage === 1}
                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                      First
                                        </button>
                                        <button
                                            onClick={() => setCurrentQuestionsPage((prev: number) => Math.max(1, prev - 1))}
                                            disabled={currentQuestionsPage === 1}
                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                      Previous
                                        </button>

                                        {/* Page numbers */}
                                        <div className="flex items-center space-x-1">
                                            {Array.from({ length: Math.min(5, Math.ceil(filteredQuestions.length / questionsPerPage)) }, (_, i) => {
                                                const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);
                                                let pageNum;

                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentQuestionsPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentQuestionsPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentQuestionsPage - 2 + i;
                                                }

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentQuestionsPage(pageNum)}
                                                        className={`px-3 py-1 text-sm border rounded-md ${
                                                            currentQuestionsPage === pageNum
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setCurrentQuestionsPage(prev => Math.min(Math.ceil(filteredQuestions.length / questionsPerPage), prev + 1))}
                                            disabled={currentQuestionsPage >= Math.ceil(filteredQuestions.length / questionsPerPage)}
                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                      Next
                                        </button>
                                        <button
                                            onClick={() => setCurrentQuestionsPage(Math.ceil(filteredQuestions.length / questionsPerPage))}
                                            disabled={currentQuestionsPage >= Math.ceil(filteredQuestions.length / questionsPerPage)}
                                            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                      Last
                                        </button>
                                    </div>

                                    {/* Items per page */}
                                    <div className="flex items-center space-x-2">
                                        <label className="text-sm text-gray-700">Per page:</label>
                                        <select
                                            value={questionsPerPage}
                                            onChange={(e) => {
                                                setQuestionsPerPage(Number(e.target.value));
                                                setCurrentQuestionsPage(1);
                                            }}
                                            className="text-sm border border-gray-300 rounded-md px-2 py-1"
                                        >
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="text-center py-12">
                            {questionsData.length === 0 ? (
                                <>
                                    <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">No questions yet</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                    Questions and comments from attendees will appear here.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Search className="mx-auto h-12 w-12 text-gray-400" />
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">No questions match your filters</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search or filter criteria.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setQuestionsSearch('');
                                            setQuestionsFilter('');
                                            setCurrentQuestionsPage(1);
                                        }}
                                        className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                    Clear all filters
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
