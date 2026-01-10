"use client";

import { useState } from "react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { Save, Loader2 } from "lucide-react";

// Mock Department List (In reality, import FUTA_DEPARTMENTS from @rcffuta/ict-lib)
const DEPARTMENTS = [
    "Mechanical Engineering",
    "Computer Science",
    "Civil Engineering",
    "Architecture",
    "Microbiology",
];

export function ProfileEdit() {
    const [isLoading, setIsLoading] = useState(false);

    // Mock Form Submit
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Call Library: await rcf.auth.updateProfile(...)
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
            {/* 1. Academic Information (Most Critical) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-rcf-navy mb-4 pb-2 border-b border-slate-100">
                    Academic Information
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <FormInput
                            label="Matric Number"
                            name="matric"
                            type="text"
                            placeholder="MEE/19/8821"
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                            Department
                        </label>
                        <FormSelect
                            label="Department"
                            name="department"
                            className="rounded-md p-2.5 text-sm w-full"
                        >
                            <option value="">Select Department</option>
                            {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                    {dept}
                                </option>
                            ))}
                        </FormSelect>
                    </div>

                    <div className="space-y-2">
                        <FormInput
                            label="Entry Year"
                            name="entryYear"
                            type="number"
                            min={2015}
                            max={2026}
                            placeholder="2019"
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                        <p className="text-[10px] text-slate-500">
                            This determines your Family Name (e.g. Army of
                            Light)
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Personal Bio Data */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-rcf-navy mb-4 pb-2 border-b border-slate-100">
                    Personal Bio-Data
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <FormInput
                            label="First Name"
                            name="firstName"
                            type="text"
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Last Name"
                            name="lastName"
                            type="text"
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Phone Number"
                            name="phone"
                            type="tel"
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                            Gender
                        </label>
                        <FormSelect
                            label="Gender"
                            name="gender"
                            className="rounded-md p-2.5 text-sm w-full"
                        >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </FormSelect>
                    </div>
                </div>
            </div>

            {/* 3. Location & Emergency */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-rcf-navy mb-4 pb-2 border-b border-slate-100">
                    Location & Contact
                </h3>
                <div className="grid gap-6">
                    <div className="space-y-2">
                        <FormInput
                            label="School Hostel Address"
                            name="schoolHostel"
                            type="text"
                            placeholder="e.g. South Gate, Success Lodge"
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <FormInput
                                    label="Next of Kin Name"
                                    name="nokName"
                                    type="text"
                                    className="rounded-md p-2.5 text-sm w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <FormInput
                                    label="Next of Kin Phone"
                                    name="nokPhone"
                                    type="tel"
                                    className="rounded-md p-2.5 text-sm w-full"
                                />
                            </div>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="sticky bottom-4 flex justify-end gap-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur-md">
                <button
                    type="button"
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 rounded-md bg-rcf-navy px-6 py-2 text-sm font-bold text-white transition-transform hover:bg-rcf-navy-light active:scale-95 disabled:opacity-70"
                >
                    {isLoading ? (
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
