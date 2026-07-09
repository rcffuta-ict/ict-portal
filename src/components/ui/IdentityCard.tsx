import { ExtractedUserProfile } from "@/lib/utils";
import { AvatarDisplay } from "./AvatarDisplay";

export function IdentityCard({profile}:{profile: ExtractedUserProfile}) {
    return (<div className="relative overflow-hidden rounded-2xl bg-rcf-navy text-white shadow-xl">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-white/5 blur-3xl"></div>

        <div className="p-6 flex flex-col items-center text-center">
            {/* Avatar Logic */}
            {/* <div className="h-28 w-28 rounded-full border-4 border-white/20 bg-white/10 flex items-center justify-center text-3xl font-bold mb-4 overflow-hidden shadow-inner">
                {profile.avatarUrl ? (
                    <img
                        src={profile.avatarUrl}
                        alt="Profile"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span>
                        {profile.firstName[0]}
                        {profile.lastName[0]}
                    </span>
                )}
            </div> */}

            <AvatarDisplay url={profile.avatarUrl} initials={`${profile.firstName[0]}${profile.lastName[0]}`} className="mb-4"/>

            <h2 className="text-xl font-bold leading-tight">
                {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-sm text-gray-300 mt-1 mb-4 font-mono tracking-wide">
                {profile.email}
            </p>

            {/* Roles Badges */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
                {profile.rolesDisplay.map((role, index) => {
                    let colorClass = "bg-slate-100 text-slate-700"; // Default (Worker/Member)

                    if (role === "The President")
                        colorClass =
                            "bg-yellow-100 text-yellow-800 border-yellow-200";
                    else if (role === "Central Executive")
                        colorClass =
                            "bg-purple-100 text-purple-800 border-purple-200";
                    else if (role === "Exco")
                        colorClass =
                            "bg-blue-100 text-blue-800 border-blue-200";
                    else if (role === "Hall Pastor")
                        colorClass =
                            "bg-orange-100 text-orange-800 border-orange-200";

                    return (
                        <span
                            key={index}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm border ${colorClass}`}
                        >
                            {role}
                        </span>
                    );
                })}
            </div>

            <div className="w-full border-t border-white/10 pt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                        Level
                    </p>
                    <p className="font-semibold">{profile.level}</p>
                </div>
                <div className="text-center border-l border-white/10">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                        Unit
                    </p>
                    <p className="font-semibold truncate px-1">
                        {profile.unit}
                    </p>
                </div>
            </div>
        </div>

        {/* ID Footer */}
        <div className="bg-[#0f0b29] p-3 text-center text-[9px] text-gray-500 tracking-[0.2em] uppercase font-bold">
            RCF FUTA Digital Identity
        </div>
    </div>)
}
