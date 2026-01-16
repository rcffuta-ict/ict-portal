"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DepartmentUtils } from "@rcffuta/ict-lib";
import { registerStepTwo, getFamiliesAction } from "../action";
import { Loader2, ArrowRight } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { useEffect, useState } from "react";
import { AlertModal, useAlertModal } from "@/components/ui/alert-modal";

// Make matric number optional for freshers
const OptionalAcademicSchema = z.object({
    matricNumber: z.string().optional(),
    department: z.string().min(1, "Department is required"),
    classSetId: z.string().min(1, "Family/Set is required"),
});

type OptionalAcademicData = z.infer<typeof OptionalAcademicSchema>;

// Hardcode current session year for display calculation (e.g., 2025/2026 session -> 2025)
const CURRENT_SESSION_YEAR = 2025; 

export default function StepAcademic({
    userId,
    onSuccess,
}: {
    userId: string;
    onSuccess: () => void;
}) {
    const [families, setFamilies] = useState<Array<{
        id: string;
        family_name: string;
        entry_year: number;
    }>>([]);
    const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<OptionalAcademicData>({
        resolver: zodResolver(OptionalAcademicSchema),
    });

    // 1. Fetch Families on Mount
    useEffect(() => {
        async function load() {
            const res = await getFamiliesAction();
            if (res.success && res.data) {
                setFamilies(res.data);
            }
            setIsLoadingFamilies(false);
        }
        load();
    }, []);

    const onSubmit = async (data: OptionalAcademicData) => {
        // If no matric number, use a placeholder for freshers
        const payload = {
            matricNumber: data.matricNumber || "PENDING",
            department: data.department,
            classSetId: data.classSetId,
        };
        
        const res = await registerStepTwo(userId, payload);
        if (res.success) {
            onSuccess();
        } else {
            showAlert({
                type: "error",
                title: "Registration Error",
                message: res.error || "Failed to save academic information",
            });
        }
    };

    const handleSkip = () => {
        showAlert({
            type: "info",
            title: "Skip Academic Step?",
            message: "You can always add your matric number later in your profile settings. Do you want to skip this step?",
            confirmText: "Skip",
            onConfirm: onSuccess,
        });
    };

    const departments = DepartmentUtils.getAllNames();

    // Helper to calculate display level (e.g. "100L")
    const getDisplayLevel = (entryYear: number) => {
        const level = (CURRENT_SESSION_YEAR - entryYear + 1) * 100;
        if (level < 100) return "Pre-Degree / Aspirant";
        if (level > 500) return "Alumni / Extra Year";
        return `${level}L`;
    };

    return (
        <>
            <AlertModal
                isOpen={isOpen}
                onClose={closeAlert}
                {...alertConfig}
            />
            
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5 animate-fade-in"
            >
                {/* Info Banner */}
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                    <p><strong>Freshers:</strong> Don&apos;t have a matric number yet? Leave it blank or skip this step!</p>
                </div>

                {/* 1. Matric Number */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                        Matric Number <span className="text-gray-400 font-normal">(Optional for freshers)</span>
                    </label>
                    <FormInput
                        {...register("matricNumber")}
                        className="w-full input-field uppercase"
                        placeholder="ABC/21/0000"
                        isMatric={true}
                    />
                    <p className="text-[10px] text-gray-400">
                        Format: DEPT/YY/NUM (e.g. MEE/19/8821)
                    </p>
                    {errors.matricNumber && (
                        <p className="text-xs text-red-500">
                            {errors.matricNumber.message}
                        </p>
                    )}
                </div>

            {/* 2. Department Select */}
            <div className="space-y-1">
                <FormSelect
                    {...register("department")}
                    label="Department"
                    className="w-full input-field bg-white"
                >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                        <option key={dept.value} value={dept.value}>
                            {dept.label}
                        </option>
                    ))}
                </FormSelect>
                {errors.department && (
                    <p className="text-xs text-red-500">
                        {errors.department.message}
                    </p>
                )}
            </div>

            {/* 3. Family / Generation Select */}
            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Academic Level / Family
                </label>
                <div className="relative">
                    <select
                        {...register("classSetId")}
                        className="w-full input-field bg-white disabled:opacity-50"
                        disabled={isLoadingFamilies}
                    >
                        <option value="">Select your Set</option>
                        {families.map((f) => (
                            <option key={f.id} value={f.id}>
                                {getDisplayLevel(f.entry_year)} —{" "}
                                {f.family_name || "Unnamed Generation"} (
                                {f.entry_year} Set)
                            </option>
                        ))}
                    </select>
                    {isLoadingFamilies && (
                        <div className="absolute right-3 top-2.5">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                    )}
                </div>
                {errors.classSetId && (
                    <p className="text-xs text-red-500">
                        {errors.classSetId.message}
                    </p>
                )}
                <p className="text-[10px] text-gray-400">
                    Your &ldquo;Family Name&rdquo; follows you from 100L to 500L.
                </p>
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleSkip}
                    className="btn-secondary flex-1"
                >
                    Skip for Now
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary flex-1"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <span className="flex items-center gap-2 justify-center">
                            Next Step <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </button>
            </div>
        </form>
        </>
    );
}