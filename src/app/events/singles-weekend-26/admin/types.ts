export interface RegistrantType {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: string;
  level: string;
  checked_in_at: string | null;
  coupon_code: string | null;
  coupon_active: boolean;
  coupon_used_at: string | null;
  relationship_status: string | null;
  questions_content: string | null;
  is_rcf_member: boolean;
  created_at?: string;
}

export interface StatsData {
  totalRegistered: number;
  checkedIn: number;
  brothers: number;
  sisters: number;
  levelBreakdown: Record<string, number>;
  registrants: RegistrantType[];
  relationshipStatus: Record<string, number>;
  rcfMembers: number;
  guests: number;
  coupons: {
    generated: number;
    redeemed: number;
  };
}

export interface LinkItem {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  shareText: string;
}

export interface ColorClasses {
  bg: string;
  text: string;
  border: string;
  iconBg: string;
}

export type TabType = "overview" | "links" | "attendees" | "questions";