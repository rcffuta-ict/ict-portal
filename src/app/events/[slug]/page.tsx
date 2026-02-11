"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Users,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getEventBySlug, getEventRegistrations } from "../actions";
import { CompactPreloader } from "@/components/ui/preloader";
import Link from "next/link";
import { format, isAfter, isBefore, startOfDay } from "date-fns";

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  is_active: boolean;
  created_at: string;
  config: Record<string, unknown> | null;
}

interface Registration {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: string;
  level: string | null;
  checked_in_at: string | null;
  created_at: string;
}

export default function EventDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegistrations, setShowRegistrations] = useState(false);

  const loadEvent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getEventBySlug(slug);
      if (result.success) {
        setEvent(result.data);
      } else {
        setError(result.error || "Event not found");
      }
    } catch (err) {
      setError("An error occurred while loading the event");
      console.error("Error loading event:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    if (!event) return;
    
    setLoadingRegistrations(true);
    try {
      const result = await getEventRegistrations(event.id);
      if (result.success) {
        setRegistrations(result.data || []);
        setShowRegistrations(true);
      }
    } catch (err) {
      console.error("Error loading registrations:", err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  useEffect(() => {
    if (slug) {
      loadEvent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <CompactPreloader 
            title="Loading Event..." 
            subtitle="Fetching event details" 
            showUserIcon={false}
          />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-900 mb-2">Event Not Found</h1>
            <p className="text-red-700 mb-6">{error || "The event you're looking for doesn't exist."}</p>
            <Link 
              href="/events"
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const today = startOfDay(new Date());
  const isUpcoming = isAfter(eventDate, today) || eventDate.getTime() === today.getTime();
  const isPast = isBefore(eventDate, today);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link 
          href="/events"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Link>

        {/* Event Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  isUpcoming ? "bg-blue-100 text-blue-600" : 
                  isPast ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-600"
                }`}>
                  <Calendar className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{event.title}</h1>
                  <p className="text-slate-500 uppercase tracking-wide text-sm font-medium">
                    Event ID: {event.slug}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                {event.is_active && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Active Event
                  </span>
                )}
                
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full ${
                  isUpcoming ? "bg-blue-100 text-blue-700" :
                  isPast ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"
                }`}>
                  <Clock className="h-4 w-4" />
                  {isUpcoming ? "Upcoming" : isPast ? "Past Event" : "Today"}
                </span>
              </div>
            </div>

            {/* Event Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <Calendar className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Event Date</p>
                  <p className="text-sm text-slate-600">{format(eventDate, "EEEE, MMMM do, yyyy")}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <Clock className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Created</p>
                  <p className="text-sm text-slate-600">{format(new Date(event.created_at), "MMM do, yyyy")}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="prose prose-slate max-w-none">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">About this Event</h3>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Registrations Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-500" />
                <h2 className="text-xl font-semibold text-slate-900">Event Registrations</h2>
              </div>
              
              {!showRegistrations ? (
                <button
                  onClick={loadRegistrations}
                  disabled={loadingRegistrations}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loadingRegistrations ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      View Registrations
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="h-4 w-4" />
                  <span>{registrations.length} {registrations.length === 1 ? 'Registration' : 'Registrations'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {!showRegistrations ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Click &quot;View Registrations&quot; to see who has registered for this event.</p>
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Registrations Yet</h3>
                <p className="text-slate-500">No one has registered for this event yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((registration, index) => (
                  <div key={registration.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {registration.first_name} {registration.last_name}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>{registration.email}</span>
                          <span>{registration.phone_number}</span>
                          {registration.level && <span>Level: {registration.level}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {registration.checked_in_at ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                          Registered
                        </span>
                      )}
                      <span className={`w-2 h-2 rounded-full ${
                        registration.gender?.toLowerCase() === 'male' ? 'bg-blue-400' : 'bg-pink-400'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}