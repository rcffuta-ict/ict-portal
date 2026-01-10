"use client";

import { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { getDashboardData, checkInUserAction } from "./actions";
import { 
    LayoutDashboard, 
    ScanLine, 
    Users, 
    UserCheck, 
    User, 
    Zap, 
    Search,
    RefreshCcw,
    X,
    CheckCircle,
    XCircle
} from "lucide-react";

export default function AdminDashboard() {
    const [mode, setMode] = useState<"dashboard" | "scanner">("dashboard");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Load Data
    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getDashboardData();
            setData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Filter Attendees
    const filteredAttendees = data?.attendees?.filter((a: any) => 
        a.first_name.toLowerCase().includes(search.toLowerCase()) || 
        a.last_name.toLowerCase().includes(search.toLowerCase())
    );

    if (mode === "scanner") {
        return <ScannerView onBack={() => { setMode("dashboard"); loadData(); }} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-pink-600 p-1.5 rounded-lg">
                            <LayoutDashboard className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-bold text-lg hidden sm:block">Admin Console</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={loadData}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <RefreshCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button 
                            onClick={() => setMode("scanner")}
                            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
                        >
                            <ScanLine className="h-4 w-4" />
                            <span className="hidden sm:inline">Scan Tickets</span>
                            <span className="sm:hidden">Scan</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 space-y-8">
                
                {/* 1. Event Overview */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {data?.event?.title || "Loading Event..."}
                        </h1>
                        <p className="text-slate-500">{data?.event?.description}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        Live Event
                    </div>
                </div>

                {/* 2. Stats Grid */}
                {data && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard 
                            label="Total Registered" 
                            value={data.stats.total} 
                            icon={Users} 
                            color="bg-blue-50 text-blue-600"
                        />
                        <StatCard 
                            label="Checked In" 
                            value={data.stats.checkedIn} 
                            icon={UserCheck} 
                            color="bg-green-50 text-green-600" 
                        />
                        <StatCard 
                            label="Guests" 
                            value={data.stats.guests} 
                            icon={User} 
                            color="bg-orange-50 text-orange-600" 
                        />
                        <StatCard 
                            label="Students" 
                            value={data.stats.members} 
                            icon={Zap} 
                            color="bg-purple-50 text-purple-600" 
                        />
                    </div>
                )}

                {/* 3. Level Breakdown */}
                {data && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4">Student Attendance by Level</h3>
                        <div className="grid grid-cols-5 gap-2 text-center">
                            {Object.entries(data.stats.levels).map(([lvl, count]: any) => (
                                <div key={lvl} className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500 font-bold uppercase">{lvl}</p>
                                    <p className="text-xl font-bold text-slate-900">{count}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. Attendees Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            Attendee List
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                                {data?.attendees?.length || 0}
                            </span>
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search name..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 w-full sm:w-64"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Level</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAttendees?.map((a: any) => (
                                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-900">
                                            {a.first_name} {a.last_name}
                                            <div className="text-xs text-slate-400 font-normal">{a.phone_number}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${a.level === 'Guest' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                                {a.level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {a.checked_in_at ? (
                                                <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xs">
                                                    <CheckCircle className="h-3 w-3" /> Present
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-slate-400 text-xs font-mono">
                                            {a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredAttendees?.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500">
                                            No attendees found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
}

// --- SCANNER VIEW COMPONENT ---

// --- OPTIMIZED SCANNER VIEW COMPONENT ---

function ScannerView({ onBack }: { onBack: () => void }) {
    const [scanResult, setScanResult] = useState<{
        status: "success" | "error";
        title: string;
        msg: string;
    } | null>(null);
    
    // Lock scanning state to prevent double-fires
    const [isScanning, setIsScanning] = useState(true);

    const handleScan = async (results: any[]) => {
        // 1. Strict checks to prevent lag/spam
        if (!isScanning || !results || results.length === 0) return;
        
        const text = results[0].rawValue;
        if (!text) return;

        // 2. Lock scanner immediately
        setIsScanning(false);

        // 3. Haptic Feedback (Short)
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);

        try {
            // 4. Server Action
            const result = await checkInUserAction(text);

            if (result.success) {
                // Success Vibrate
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                
                setScanResult({
                    status: "success",
                    title: "Access Granted",
                    msg: `${result.data?.fullName || 'Attendee'} • ${result.data?.level || ''}`,
                });
            } else {
                // Error Vibrate (Long)
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(400);

                setScanResult({
                    status: "error",
                    title: "Access Denied",
                    msg: result.error || "Unknown error",
                });
            }
        } catch (err) {
            setScanResult({
                status: "error",
                title: "System Error",
                msg: "Connection failed",
            });
        }
    };

    // Reset function to clear state and unlock scanner
    const resetScanner = () => {
        setScanResult(null);
        // Small delay before reactivating scanner to let user move phone away
        setTimeout(() => setIsScanning(true), 500);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-900/90 backdrop-blur-md border-b border-white/10 z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-pink-600 p-1.5 rounded text-white">
                        <ScanLine className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-sm leading-none">Ticket Scanner</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className={`relative flex h-2 w-2 rounded-full ${isScanning ? 'bg-green-500' : 'bg-red-500'}`}>
                              {isScanning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                                {isScanning ? "Camera Active" : "Processing..."}
                            </span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={onBack}
                    className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>
            </div>

            {/* Camera Area */}
            <div className="flex-1 relative bg-black">
                <Scanner 
                    onScan={handleScan}
                    // IMPORTANT: Delay helps performance significantly
                    scanDelay={500} 
                    components={{ finder: false }}
                    constraints={{ facingMode: 'environment' }} // Force back camera
                    styles={{ container: { height: "100%", width: "100%" } }}
                />

                {/* Viewfinder Overlay (Only visible when idle) */}
                {!scanResult && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-72 h-72 opacity-80">
                            <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-pink-500 rounded-tl-2xl"></div>
                            <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-pink-500 rounded-tr-2xl"></div>
                            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-pink-500 rounded-bl-2xl"></div>
                            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-pink-500 rounded-br-2xl"></div>
                            <div className="absolute inset-x-4 top-0 h-0.5 bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                        </div>
                        <p className="absolute bottom-20 text-white/70 text-sm font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
                            Align QR code within frame
                        </p>
                    </div>
                )}

                {/* Result Overlay */}
                {scanResult && (
                    <div 
                        onClick={resetScanner}
                        className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in zoom-in duration-200 cursor-pointer ${
                            scanResult.status === 'success' ? 'bg-green-900/80' : 'bg-red-900/80'
                        }`}
                    >
                        <div className="bg-white rounded-3xl p-8 text-center shadow-2xl w-full max-w-sm transform transition-all">
                            <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
                                scanResult.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                                {scanResult.status === "success" ? (
                                    <CheckCircle className="h-10 w-10" />
                                ) : (
                                    <XCircle className="h-10 w-10" />
                                )}
                            </div>
                            
                            <h2 className={`text-3xl font-bold mb-2 ${
                                scanResult.status === 'success' ? 'text-green-700' : 'text-red-700'
                            }`}>
                                {scanResult.title}
                            </h2>
                            
                            <p className="text-xl font-medium text-slate-700 leading-snug">
                                {scanResult.msg}
                            </p>

                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm uppercase tracking-wider animate-pulse">
                                    Tap to Scan Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 5%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 95%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}