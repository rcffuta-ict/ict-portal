"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { LocationDataSchema, type LocationData } from "@rcffuta/ict-lib";
import { registerStepThree } from "../action";
import { Loader2, CheckCircle } from "lucide-react";
import FormInput from "@/components/ui/FormInput";

export default function StepLocation({ userId }: { userId: string }) {
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LocationData>({
        resolver: zodResolver(LocationDataSchema),
    });

    const onSubmit = async (data: LocationData) => {
        const res = await registerStepThree(userId, data);
        if (res.success) {
            router.push("/dashboard"); // Redirect to Dashboard
        } else {
            alert(res.error);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    School Address (Hostel/Lodge)
                </label>
                <FormInput
                    {...register("schoolAddress")}
                    className="w-full input-field"
                    placeholder="South Gate, Success Lodge"
                />
                {errors.schoolAddress && (
                    <p className="text-xs text-red-500">
                        {errors.schoolAddress.message}
                    </p>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Home Address (Holidays)
                </label>
                <textarea
                    {...register("homeAddress")}
                    className="w-full input-field min-h-[80px]"
                    placeholder="Street, City, State"
                />
                {errors.homeAddress && (
                    <p className="text-xs text-red-500">
                        {errors.homeAddress.message}
                    </p>
                )}
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full mt-4 bg-green-600 hover:bg-green-700"
            >
                {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <span className="flex items-center gap-2">
                        Complete Registration{" "}
                        <CheckCircle className="h-4 w-4" />
                    </span>
                )}
            </button>
        </form>
    );
}
