/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Save, Loader2, RefreshCcw } from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { DepartmentUtils } from "@rcffuta/ict-lib";
import { getZonesAction } from "@/app/(auth)/register/action";
import { updateProfileAction } from "@/app/dashboard/profile/actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export function ProfileEdit() {
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();
    const userProfile = useProfileStore((state) => state.user);
    const updateStoreBio = useProfileStore((state) => state.updateBio);
    const updateStoreLocation = useProfileStore(
        (state) => state.updateLocation,
    );
    const updateStoreAcademics = useProfileStore(
        (state) => state.updateAcademics,
    );

    const [zones, setZones] = useState<any[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);

    const departments = DepartmentUtils.getAllNames();

    const {
        register,
        handleSubmit,
        reset,
        formState: { isSubmitting, isDirty, errors },
    } = useForm({
        mode: "onChange",
        defaultValues: {
            firstName: userProfile?.profile.firstName || "",
            lastName: userProfile?.profile.lastName || "",
            middleName: userProfile?.profile.middleName || "",
            email: userProfile?.profile.email || "",
            phoneNumber: userProfile?.profile.phoneNumber || "",
            gender: userProfile?.profile.gender || "",
            dob: userProfile?.profile.dob || "",
            currentLevel: userProfile?.academics?.currentLevel || "",
            matricNumber: userProfile?.academics?.matricNumber || "",
            department: userProfile?.academics?.department || "",
            residentialZoneId: userProfile?.location?.residentialZone || "",
            schoolAddress: userProfile?.location?.schoolAddress || "",
            homeAddress: userProfile?.location?.homeAddress || "",
        },
    });

    useEffect(() => {
        async function loadData() {
            const zonesRes = await getZonesAction();
            if (zonesRes.success && zonesRes.data) {
                setZones(zonesRes.data);
            }
            setIsLoadingZones(false);
        }
        loadData();
    }, []);

    const onSubmit = async (data: any) => {
        try {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                formData.append(key, value as string);
            });

            const res = await updateProfileAction(formData, userProfile?.profile.id || "");

            if (res.success) {
                // Optimistic Update
                updateStoreBio({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    middleName: data.middleName,
                    phoneNumber: data.phoneNumber,
                    gender: data.gender,
                    dob: data.dob,
                });

                updateStoreLocation({
                    schoolAddress: data.schoolAddress,
                    homeAddress: data.homeAddress,
                    residentialZone: zones.find(
                        (z) => z.id === data.residentialZoneId,
                    )?.name,
                });

                updateStoreAcademics({
                    currentLevel: data.currentLevel,
                });

                // Reset form dirty state with new values
                reset(data);

                showAlert({
                    type: "success",
                    message: "Profile updated successfully!",
                });
            } else {
                console.error("Profile update error:", res.error);
                showAlert({
                    type: "error",
                    message: res.error || "Could not update profile"
                });
            }
        } catch (error) {
            console.error("Unexpected error during profile update:", error);
            showAlert({
                type: "error",
                message: "An unexpected error occurred. Please try again."
            });
        }
    };

    if (!userProfile)
        return <div className="p-8 text-center text-slate-500">Loading...</div>;

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-8 max-w-3xl animate-in fade-in"
        >
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {/* 1. BIO DATA */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 pb-2 border-b border-slate-100">
                    Personal Information
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <FormInput label="First Name" {...register("firstName")} />
                    <FormInput label="Last Name" {...register("lastName")} />
                    <FormInput
                        label="Middle Name"
                        {...register("middleName")}
                    />
                    <FormInput
                        label="Date of Birth"
                        type="date"
                        {...register("dob")}
                    />
                    <FormInput
                        label="Email"
                        {...register("email")}
                        disabled
                        className="bg-slate-50 text-slate-500"
                    />
                    <FormInput label="Phone" {...register("phoneNumber")} />
                    <FormSelect
                        label="Gender"
                        {...register("gender")}
                        // disabled
                        className="bg-slate-50"
                    >
                        <option value="">Select Gender...</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </FormSelect>
                </div>
            </div>

            {/* 2. FELLOWSHIP */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 pb-2 border-b border-slate-100">
                    Fellowship
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <FormSelect
                        label="Level"
                        {...register("currentLevel")}
                    >
                        <option value="">Select Level...</option>
                        <option value="100L">100L</option>
                        <option value="200L">200L</option>
                        <option value="300L">300L</option>
                        <option value="400L">400L</option>
                        <option value="500L">500L</option>
                    </FormSelect>
                </div>
            </div>

            {/* 3. ACADEMICS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 pb-2 border-b border-slate-100">
                    Academic Details
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <FormInput
                        label="Matric Number"
                        {...register("matricNumber")}
                        disabled
                        className="uppercase bg-slate-50 text-slate-500"
                    />
                    <FormSelect
                        label="Department"
                        {...register("department")}
                        disabled
                        className="bg-slate-50"
                    >
                        {departments.map((dept) => (
                            <option key={dept.value} value={dept.value}>
                                {dept.label}
                            </option>
                        ))}
                    </FormSelect>
                </div>
                <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100">
                    Academic details are locked to preserve your level history.
                    Contact admin for corrections.
                </div>
            </div>

            {/* 4. LOCATION */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 pb-2 border-b border-slate-100">
                    Location & Contact
                </h3>
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                            School Residence
                        </h4>
                        <FormSelect
                            label="Residential Zone"
                            {...register("residentialZoneId")}
                            disabled={isLoadingZones}
                        >
                            <option value="">Select Zone...</option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    {z.name}
                                </option>
                            ))}
                        </FormSelect>
                        <div className="space-y-1">
                            <FormInput
                                label="Hostel Address"
                                {...register("schoolAddress", {
                                    required: "School address is required",
                                    minLength: {
                                        value: 5,
                                        message:
                                            "Address is too short (min 5 chars)",
                                    },
                                })}
                                placeholder="e.g. Success Lodge, Room 10"
                            />
                            {/* Show Error Message */}
                            {errors.schoolAddress && (
                                <p className="text-xs text-red-500 ml-1">
                                    {errors.schoolAddress.message as string}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                            Home Address
                        </h4>
                        <div className="space-y-1">
                            <textarea
                                {...register("homeAddress")}
                                className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-white p-4 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-400"
                                placeholder="Street, City, State..."
                            />
                            {/* Show Error Message */}
                            {errors.homeAddress && (
                                <p className="text-xs text-red-500 ml-1">
                                    {errors.homeAddress.message as string}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="sticky bottom-6 flex justify-end gap-4 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0">
                <button
                    type="button"
                    onClick={() => reset()}
                    disabled={!isDirty || isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                    <RefreshCcw className="h-4 w-4" /> Reset
                </button>

                <button
                    type="submit"
                    disabled={!isDirty || isSubmitting}
                    className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-rcf-navy rounded-xl shadow-lg shadow-rcf-navy/20 hover:bg-opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Changes
                </button>
            </div>
        </form>
    );
}
