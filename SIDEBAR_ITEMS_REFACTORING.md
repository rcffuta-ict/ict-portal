# Sidebar Items Refactoring Summary

## Overview
Extracted sidebar navigation items into a shared configuration file to follow the DRY (Don't Repeat Yourself) principle. This ensures a single source of truth for navigation items across the application.

## Changes Made

### 1. Created Shared Configuration (`src/config/sidebar-items.tsx`)

**Purpose**: Central configuration for all navigation items used across the application.

**Exports**:
- `SidebarItem` interface - TypeScript type for navigation items
- `baseSidebarItems` - Array of navigation items available to all users
- `adminSidebarItems` - Array of navigation items available only to admins
- `getSidebarItems(isAdmin: boolean)` - Function to get filtered items based on admin status
- `isUserAdmin(email)` - Function to check if a user is an admin

**Item Properties**:
```typescript
interface SidebarItem {
    name: string;           // Display name
    href: string;           // Navigation path
    icon: LucideIcon;       // Icon component
    color: string;          // Tailwind color class (bg-*)
    description: string;    // Description for dashboard cards
    comingSoon?: boolean;   // Flag for features in development
    adminOnly?: boolean;    // Flag for admin-only features
}
```

**Base Items** (7 items):
1. Overview - Dashboard home
2. My Identity - Profile management
3. Attendance - QR code scanning (Coming Soon)
4. Academics - CGPA & Past Questions (Coming Soon)
5. Elections - Voting system (Coming Soon)
6. Events - Event registration (Coming Soon)
7. Financials - Dues and pledges (Coming Soon)

**Admin Items** (1 item):
1. Tenure Manager - Admin-only tenure management

### 2. Updated Sidebar Component (`src/components/layout/sidebar.tsx`)

**Before**:
- Had inline `baseSidebarItems` and `adminSidebarItems` definitions
- Implemented custom admin check logic
- Built `sidebarItems` array manually

**After**:
- Imports `getSidebarItems` and `isUserAdmin` from shared config
- Uses `isUserAdmin(user?.profile?.email)` for admin check
- Uses `getSidebarItems(isAdmin)` to get filtered items
- Removed duplicate code

**Benefits**:
- Cleaner component code
- Consistent admin logic
- Single source of truth

### 3. Updated Dashboard Page (`src/app/dashboard/page.tsx`)

**Before**:
- Had one hardcoded `ServiceCard` for My Identity
- Had commented out service cards for other features
- No dynamic generation

**After**:
- Dynamically generates service cards from shared config
- Filters out "Overview" (shown in sidebar only, not as card)
- Uses `getSidebarItems(isAdmin)` for filtered items
- Shows "Coming Soon" badge for features in development
- Disables interaction for coming soon features

**ServiceCard Component Updates**:
- Now accepts `item: SidebarItem` prop
- Displays "Coming Soon" badge when `comingSoon: true`
- Prevents navigation for coming soon items
- Applies different styling for disabled cards
- Uses item's color and description properties

## Admin Filtering

**How It Works**:
1. `isUserAdmin(email)` checks if user email is in `NEXT_PUBLIC_ADMIN_EMAILS` env variable
2. `getSidebarItems(isAdmin)` returns base items + admin items if user is admin
3. Both sidebar and dashboard use the same logic for consistency

**Environment Variable**:
```env
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,another@example.com
```

**Security Note**: This is client-side filtering for UI only. Server-side actions must still verify admin access using `checkAdminAccess()`.

## Usage Examples

### Getting Items for Current User
```typescript
import { getSidebarItems, isUserAdmin } from "@/config/sidebar-items";

const user = useProfileStore((state) => state.user);
const isAdmin = isUserAdmin(user?.profile?.email);
const items = getSidebarItems(isAdmin);
```

### Rendering Service Cards
```typescript
const serviceCards = items.filter(item => item.name !== "Overview");

{serviceCards.map((item) => (
    <ServiceCard key={item.href} item={item} />
))}
```

### Adding a New Navigation Item
1. Add to `baseSidebarItems` or `adminSidebarItems` in `sidebar-items.tsx`:
```typescript
{
    name: "New Feature",
    href: "/dashboard/new-feature",
    icon: NewIcon,
    color: "bg-teal-500",
    description: "Description for dashboard card",
    comingSoon: false, // Set to true for features in development
}
```
2. Item automatically appears in:
   - Sidebar navigation
   - Dashboard service cards
   - Filtered appropriately for admin users

## Benefits of This Refactoring

1. **Single Source of Truth**: All navigation items defined in one place
2. **DRY Principle**: No duplicate item definitions
3. **Consistency**: Same admin filtering logic everywhere
4. **Type Safety**: TypeScript interface ensures all required properties
5. **Maintainability**: Easy to add/modify navigation items
6. **Scalability**: Easy to add new properties (badges, permissions, etc.)
7. **Reusability**: Can use items anywhere in the app

## Testing Checklist

- [ ] Sidebar shows all base items for regular users
- [ ] Sidebar shows admin items only for admin emails
- [ ] Dashboard cards match sidebar items (except Overview)
- [ ] "Coming Soon" badge appears on appropriate cards
- [ ] Coming soon cards don't navigate when clicked
- [ ] Admin filtering works consistently in both places
- [ ] Mobile sidebar still responsive
- [ ] No TypeScript errors
- [ ] No console errors in browser

## Files Modified

1. ✅ `/src/config/sidebar-items.tsx` - Created
2. ✅ `/src/components/layout/sidebar.tsx` - Updated to use shared config
3. ✅ `/src/app/dashboard/page.tsx` - Updated to generate cards from shared config

## Next Steps (Optional Enhancements)

1. Add role-based permissions (beyond just admin)
2. Add badge support (e.g., "New", "Beta", custom badges)
3. Add nested navigation support for submenus
4. Add item visibility conditions (e.g., show only during certain tenures)
5. Add analytics tracking for navigation clicks
6. Add keyboard shortcuts for navigation items
