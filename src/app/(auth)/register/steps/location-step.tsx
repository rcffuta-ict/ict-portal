"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerStepThree, getZonesAction } from "../action";
import { Loader2, CheckCircle, MapPin, Home } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { useEffect, useState } from "react";
import { z } from "zod";

// Make all fields optional for this step
const OptionalLocationSchema = z.object({
    residentialZoneId: z.string().optional(),
    schoolAddress: z.string().optional(),
    homeAddress: z.string().optional(),
});

type OptionalLocationData = z.infer<typeof OptionalLocationSchema>;

export default function StepLocation({ userId }: { userId: string }) {
    const router = useRouter();
    const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<OptionalLocationData>({
        resolver: zodResolver(OptionalLocationSchema),
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

    // 2. Submit Handler
    const onSubmit = async (data: OptionalLocationData) => {
        // If all fields are empty, allow skip
        const hasAnyData = data.residentialZoneId || data.schoolAddress || data.homeAddress;
        
        if (hasAnyData) {
            // Submit with whatever data they provided
            const res = await registerStepThree(userId, {
                residentialZoneId: data.residentialZoneId,
                schoolAddress: data.schoolAddress || "",
                homeAddress: data.homeAddress || "",
            });
            if (res.success) {
                router.push("/dashboard");
            } else {
                alert(res.error);
            }
        } else {
            // Skip this step entirely
            router.push("/dashboard");
        }
    };

    const handleSkip = () => {
        router.push("/dashboard");
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-fade-in">
            
            {/* Info Banner */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
                <p><strong>Optional:</strong> You can skip this step and complete it later in your profile settings.</p>
            </div>

            {/* SECTION 1: SCHOOL RESIDENCE */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-rcf-navy border-b border-gray-100 pb-2">
                    <MapPin className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">School Residence (Optional)</h3>
                </div>

                <div className="space-y-4">
                    <FormSelect
                        {...register("residentialZoneId")}
                        label="Residential Zone"
                        className="w-full"
                        disabled={isLoadingZones}
                    >
                        <option value="">Select Zone (e.g. South Gate)</option>
                        {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                                {z.name}
                            </option>
                        ))}
                    </FormSelect>
                    {errors.residentialZoneId && (
                        <p className="text-xs text-red-500">{errors.residentialZoneId.message}</p>
                    )}

                    <FormInput
                        {...register("schoolAddress")}
                        label="School Hostel Address"
                        placeholder="e.g. Success Lodge, Room 10B"
                        className="w-full"
                    />
                    {errors.schoolAddress && (
                        <p className="text-xs text-red-500">{errors.schoolAddress.message}</p>
                    )}
                </div>
            </div>

            {/* SECTION 2: HOME ADDRESS */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-rcf-navy border-b border-gray-100 pb-2">
                    <Home className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">Home Address (Optional)</h3>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                        Holiday Location (Street, City, State)
                    </label>
                    <textarea
                        {...register("homeAddress")}
                        className="w-full min-h-20 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition-all focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400 resize-none"
                        placeholder="e.g. 21, Allen Avenue, Ikeja, Lagos State"
                    />
                    {errors.homeAddress && (
                        <p className="text-xs text-red-500 ml-1">
                            {errors.homeAddress.message}
                        </p>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                    Skip for Now
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-200 transition-colors disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Complete Registration
                            <CheckCircle className="h-5 w-5" />
                        </span>
                    )}
                </button>
            </div>
        </form>
    );
}