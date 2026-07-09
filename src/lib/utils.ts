import { DepartmentUtils, FullUserProfile, LeadershipRole, UnitMembership } from "@rcffuta/ict-lib";

export type ExtractedUserProfile = {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    dob: string;
    avatarUrl?: string;

    // Academic
    matric: string;
    dept: string;
    faculty: string;
    level: string;
    family: string;
    entryYear: string;

    // Location
    hostel: string;
    home: string;
    zone: string;

    // Fellowship
    unit: string;
    rolesDisplay: string[];

    teamsList: string;
};

export function displayLevelBetter(level: FullUserProfile['academics']['currentLevel']) {
  switch (level) {
    case '100L':
      return 'Fresher';
    case '200L':
      return '200 Level';
    case '300L':
      return '300 Level';
    case '400L':
      return '400 Level';
    case '500L':
      return '500 Level';
    default:
      return level;
  }
}

export function truncate(text: string | null | undefined, length: number) {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}

// Format Helper
export const formatDate = (dateString?: string) => {
    if (!dateString) return "Not Set";
    return new Date(dateString).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};


export const getRoleCategories = (roles: LeadershipRole[] | null, unit: UnitMembership | null) => {
    const badges = new Set<string>();

    // 1. Leadership Roles
    if (roles && roles.length > 0) {
        roles.forEach((role) => {
            switch (role.scope) {
                case "PRESIDENT":
                    badges.add("President");
                    break;
                case "CENTRAL":
                    badges.add("Central");
                    break;
                case "ZONE":
                    badges.add("Hall Pastor"); // Distinction for delegates
                    break;
                case "UNIT":
                case "LEVEL":
                case "TEAM":
                    badges.add("Executive"); // Unit/Team/Level Heads
                    break;
                default:
                    break;
            }
        });
    }

    // 2. Worker Status
    // If they are in a unit, they are a worker.
    // Even if they are a Hall Pastor, they are likely a worker in a unit too.
    if (unit) {
        badges.add("Worker");
    }

    // 3. Member Fallback
    if (badges.size === 0) {
        return ["Member"];
    }

    // Sort to ensure President comes first
    return Array.from(badges).sort((a, b) => {
        const priority = [
            "President",
            "Central",
            "Executive",
            "Hall Pastor",
            "Worker",
        ];
        return priority.indexOf(a) - priority.indexOf(b);
    });
};

export function extractUserProfileInfo(userData: FullUserProfile): ExtractedUserProfile  {
    const {profile, academics, location, unit, roles, teams} = userData;
    return {
        fullName: `${profile.firstName} ${profile.middleName ? profile.middleName + " " : ""}${profile.lastName}`,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phoneNumber,
        gender: profile.gender,
        dob: formatDate(profile.dob),
        avatarUrl: profile.avatarUrl,

        // Academic
        matric: academics?.matricNumber || "Not Set",
        dept: academics?.department
            ? DepartmentUtils.getByAlias(academics.department)?.name ||
                academics.department
            : "Not Set",

        faculty: academics?.faculty || "Not Set",
        level: academics?.currentLevel || "Not Set",
        family: academics?.family || "Not Set",
        entryYear: academics?.entryYear?.toString() || "Not Set",

        // Location
        hostel: location?.schoolAddress || "Not Set",
        home: location?.homeAddress || "Not Set",
        zone: location?.residentialZone || "Unassigned",

        // Fellowship
        unit: unit?.name || "None",
        // If roles exist, map titles. If not, check if they have a unit to call them a "Worker", else "Member".
        rolesDisplay: getRoleCategories(roles, unit),

        teamsList:
            teams && teams.length > 0
                ? teams.map((t) => t.name).join(", ")
                : "No Teams",
    };
}
