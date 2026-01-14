"use client";

import { useState, useMemo } from "react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { Save, Loader2 } from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { DepartmentUtils } from "@rcffuta/ict-lib";

export function ProfileEdit() {
    const [isLoading, setIsLoading] = useState(false);
    // const [families, setFamilies] = useState<any[]>([]);
    // const [zones, setZones] = useState<any[]>([]);
    // const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
    // const [isLoadingZones, setIsLoadingZones] = useState(true);
    
    const userProfile = useProfileStore((state) => state.user);
    const updateStoreBio = useProfileStore((state) => state.updateBio);
    const updateStoreLocation = useProfileStore((state) => state.updateLocation);
    const updateStoreAcademics = useProfileStore((state) => state.updateAcademics);

    // Get departments from library
    const departments = DepartmentUtils.getAllNames();

    // Get departments from library
    // const departments = DepartmentUtils.getAllNames();

    // TODO: Add these actions when ready
    // import { getFamiliesAction, getZonesAction } from "@/app/(auth)/register/action";
    // Fetch families and zones on mount
    // useEffect(() => {
    //     async function loadData() {
    //         const [familiesRes, zonesRes] = await Promise.all([
    //             getFamiliesAction(),
    //             getZonesAction()
    //         ]);
    //         if (familiesRes.success && familiesRes.data) setFamilies(familiesRes.data);
    //         if (zonesRes.success && zonesRes.data) setZones(zonesRes.data);
    //         setIsLoadingFamilies(false);
    //         setIsLoadingZones(false);
    //     }
    //     loadData();
    // }, []);

    // Form state initialized from profile store using useMemo to avoid re-initialization
    const initialFormData = useMemo(() => {
        if (!userProfile) return null;
        
        // Parse school address to extract lodge and room
        const schoolAddr = userProfile.location?.schoolAddress || "";
        const lodgeMatch = schoolAddr.match(/^(.+?),\s*Room\s+(.+)$/i);
        
        return {
            // Bio
            firstName: userProfile.profile.firstName || "",
            lastName: userProfile.profile.lastName || "",
            middleName: userProfile.profile.middleName || "",
            email: userProfile.profile.email || "",
            phoneNumber: userProfile.profile.phoneNumber || "",
            gender: userProfile.profile.gender || "",
            dob: userProfile.profile.dob || "",
            
            // Academic
            matricNumber: userProfile.academics?.matricNumber || "",
            department: userProfile.academics?.department || "",
            classSetId: "", // Will be populated from backend if needed
            
            // Location
            residentialZoneId: "", // Will be populated from backend if needed
            lodgeName: lodgeMatch ? lodgeMatch[1] : "",
            roomNumber: lodgeMatch ? lodgeMatch[2] : "",
            homeAddress: userProfile.location?.homeAddress || "",
        };
    }, [userProfile]);

    const [formData, setFormData] = useState(initialFormData || {
        firstName: "",
        lastName: "",
        middleName: "",
        email: "",
        phoneNumber: "",
        gender: "",
        dob: "",
        matricNumber: "",
        department: "",
        classSetId: "",
        residentialZoneId: "",
        lodgeName: "",
        roomNumber: "",
        homeAddress: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    // Mock Form Submit (leave action for user)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        // TODO: User will implement the actual API call here
        // Example: await rcf.user.updateProfile(formData)
        
        // Combine lodge and room into schoolAddress
        const schoolAddress = formData.lodgeName && formData.roomNumber 
            ? `${formData.lodgeName}, Room ${formData.roomNumber}`
            : "";
        
        // Optimistic update to store
        updateStoreBio({
            firstName: formData.firstName,
            lastName: formData.lastName,
            middleName: formData.middleName,
            phoneNumber: formData.phoneNumber,
            gender: formData.gender,
            dob: formData.dob,
            email: formData.email,
        });
        
        updateStoreAcademics({
            matricNumber: formData.matricNumber,
            department: formData.department,
        });
        
        updateStoreLocation({
            schoolAddress: schoolAddress,
            homeAddress: formData.homeAddress,
        });
        
        setTimeout(() => setIsLoading(false), 2000);
    };

    if (!userProfile) {
        return (
            <div className="flex items-center justify-center min-h-75">
                <p className="text-slate-500">Loading profile data...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
            {/* 1. Personal Bio Data */}
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
                            value={formData.firstName}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Last Name"
                            name="lastName"
                            type="text"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Middle Name"
                            name="middleName"
                            type="text"
                            value={formData.middleName}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Date of Birth"
                            name="dob"
                            type="date"
                            value={formData.dob}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Email Address"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                            placeholder="john@example.com"
                            disabled
                        />
                    </div>
                    <div className="space-y-2">
                        <FormInput
                            label="Phone Number"
                            name="phoneNumber"
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                            placeholder="08012345678"
                        />
                    </div>
                    <div className="space-y-2">
                        <FormSelect
                            label="Gender"
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                            disabled
                        >
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </FormSelect>
                    </div>
                </div>
            </div>

            {/* 2. Academic Information */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-rcf-navy mb-4 pb-2 border-b border-slate-100">
                    Academic Information
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <FormInput
                            label="Matric Number"
                            name="matricNumber"
                            type="text"
                            placeholder="ABC/21/0000"
                            value={formData.matricNumber}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full uppercase"
                            isMatric={true}
                            disabled
                        />
                        <p className="text-[10px] text-slate-500">
                            Format: DEPT/YY/NUM (e.g. MEE/19/8821)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <FormSelect
                            label="Department"
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            className="rounded-md p-2.5 text-sm w-full"
                            disabled
                        >
                            <option value="">Select Department</option>
                            {departments.map((dept) => (
                                <option key={dept.value} value={dept.value}>
                                    {dept.label}
                                </option>
                            ))}
                        </FormSelect>
                    </div>
                </div>

                <p className="text-xs text-slate-500 mt-4 bg-blue-50 p-3 rounded-md">
                    <strong>Note:</strong> Your academic level and family are
                    determined by your entry year. Contact admin if you need to
                    update your class set.
                </p>
            </div>

            {/* 3. Location & Contact */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-rcf-navy mb-4 pb-2 border-b border-slate-100">
                    Location & Contact
                </h3>

                {/* School Residence */}
                <div className="space-y-4 mb-6">
                    <h4 className="text-sm font-semibold text-slate-700">
                        School Residence
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                                Lodge Name
                            </label>
                            <input
                                name="lodgeName"
                                value={formData.lodgeName}
                                onChange={handleChange}
                                placeholder="e.g. Success Lodge"
                                className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                                Room No.
                            </label>
                            <input
                                name="roomNumber"
                                value={formData.roomNumber}
                                onChange={handleChange}
                                placeholder="e.g. 10B"
                                className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Home Address */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-700">
                        Home Address
                    </h4>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                            Holiday Location (Street, City, State)
                        </label>
                        <textarea
                            name="homeAddress"
                            value={formData.homeAddress}
                            onChange={handleChange}
                            className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition-all focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400 resize-none"
                            placeholder="e.g. 21, Allen Avenue, Ikeja, Lagos State"
                        />
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
