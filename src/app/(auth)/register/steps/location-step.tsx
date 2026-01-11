"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { LocationDataSchema, type LocationData } from "@rcffuta/ict-lib";
import { registerStepThree, getZonesAction } from "../action";
import { Loader2, CheckCircle, MapPin, Home } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { useEffect, useState } from "react";

export default function StepLocation({ userId }: { userId: string }) {
    const router = useRouter();
    const [zones, setZones] = useState<any[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<LocationData>({
        resolver: zodResolver(LocationDataSchema),
    });

    // 1. Fetch Zones on Mount
    useEffect(() => {
        async function load() {
            const res = await getZonesAction();
            if (res.success && res.data) {
                setZones(res.data);
            }
            setIsLoadingZones(false);
        }
        load();
    }, []);

    // 2. Custom Submit Handler
    // We capture the split fields (Lodge, Room) and combine them into 'schoolAddress'
    const onCustomSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        const lodge = formData.get("lodge_name") as string;
        const room = formData.get("room_number") as string;
        
        // Format: "Success Lodge, Room 10"
        const finalSchoolAddress = `${lodge}, Room ${room}`;
        
        // Manually set the combined value for Zod validation
        setValue("schoolAddress", finalSchoolAddress);

        // Trigger the actual RHF submit
        handleSubmit(async (data) => {
            const res = await registerStepThree(userId, data);
            if (res.success) {
                router.push("/dashboard");
            } else {
                alert(res.error);
            }
        })();
    };

    return (
        <form onSubmit={onCustomSubmit} className="space-y-6 animate-fade-in">
            
            {/* SECTION 1: SCHOOL RESIDENCE */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-rcf-navy border-b border-gray-100 pb-2">
                    <MapPin className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">School Residence</h3>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                        Residential Zone
                    </label>
                    <div className="relative">
                        <select
                            {...register("residentialZoneId")}
                            className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition-all focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 cursor-pointer disabled:opacity-50"
                            disabled={isLoadingZones}
                        >
                            <option value="">Select Zone (e.g. South Gate)</option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    {z.name}
                                </option>
                            ))}
                        </select>
                        {isLoadingZones && (
                            <div className="absolute right-4 top-3.5">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                        )}
                    </div>
                    {errors.residentialZoneId && (
                        <p className="text-xs text-red-500 ml-1">{errors.residentialZoneId.message}</p>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Lodge Name</label>
                        <input 
                            name="lodge_name" 
                            required 
                            placeholder="e.g. Success Lodge" 
                            className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Room No.</label>
                        <input 
                            name="room_number" 
                            required 
                            placeholder="e.g. 10B" 
                            className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 2: HOME ADDRESS */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-rcf-navy border-b border-gray-100 pb-2">
                    <Home className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">Home Address</h3>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                        Holiday Location (Street, City, State)
                    </label>
                    <textarea
                        {...register("homeAddress")}
                        className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition-all focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400 resize-none"
                        placeholder="e.g. 21, Allen Avenue, Ikeja, Lagos State"
                    />
                    {errors.homeAddress && (
                        <p className="text-xs text-red-500 ml-1">
                            {errors.homeAddress.message}
                        </p>
                    )}
                </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full mt-6 bg-green-600 hover:bg-green-700 h-12 text-base shadow-lg shadow-green-200"
            >
                {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <span className="flex items-center gap-2">
                        Complete Registration{" "}
                        <CheckCircle className="h-5 w-5" />
                    </span>
                )}
            </button>
        </form>
    );
}