# Quick Reference: Sidebar Items Configuration

## Adding a New Navigation Item

1. **Open** `src/config/sidebar-items.tsx`

2. **Add to appropriate array**:

   For all users:
   ```typescript
   export const baseSidebarItems: SidebarItem[] = [
     // ... existing items
     {
       name: "Your Feature",
       href: "/dashboard/your-feature",
       icon: YourIcon, // Import from lucide-react
       color: "bg-purple-500", // Any Tailwind bg-* color
       description: "Short description for dashboard card",
       comingSoon: false, // Set true to show "Coming Soon" badge
     },
   ];
   ```

   For admins only:
   ```typescript
   export const adminSidebarItems: SidebarItem[] = [
     // ... existing items
     {
       name: "Admin Feature",
       href: "/dashboard/admin-feature",
       icon: AdminIcon,
       color: "bg-red-500",
       description: "Admin-only feature description",
       adminOnly: true, // Always true for admin items
     },
   ];
   ```

3. **Import icon** at top of file:
   ```typescript
   import { YourIcon } from "lucide-react";
   ```

4. **Done!** Item automatically appears in:
   - Sidebar navigation
   - Dashboard service cards

## Checking Admin Status

```typescript
import { isUserAdmin } from "@/config/sidebar-items";

const user = useProfileStore((state) => state.user);
const isAdmin = isUserAdmin(user?.profile?.email);
```

## Getting Filtered Items

```typescript
import { getSidebarItems } from "@/config/sidebar-items";

const items = getSidebarItems(isAdmin);
```

## Environment Setup

Set admin emails in `.env.local`:
```env
NEXT_PUBLIC_ADMIN_EMAILS=admin@rcffuta.org,another@rcffuta.org
```

## File Locations

- Configuration: `/src/config/sidebar-items.tsx`
- Sidebar: `/src/components/layout/sidebar.tsx`
- Dashboard: `/src/app/dashboard/page.tsx`
