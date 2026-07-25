# Tenure Dashboard Module

A comprehensive administrative interface for managing RCF fellowship tenures, organizational structure, leadership appointments, and family assignments.

---

## 📁 File Structure

```
src/app/dashboard/tenure/
├── page.tsx                    # Main dashboard page (tab navigation)
├── actions.ts                  # Server actions for all operations
├── ACTIONS_REFERENCE.md        # Detailed action documentation
├── README.md                   # This file
└── components/
    ├── tenure-tab.tsx          # Tenure creation, editing, closure
    ├── structure-tab.tsx       # Units/teams management
    ├── cabinet-tab.tsx         # Leadership appointments & positions
    ├── family-tab.tsx          # Entry year family naming
    └── manage-unit-modal.tsx   # Unit-specific leader management
```

---

## 🎯 Features Overview

### 1. **Tenure Management** (`tenure-tab.tsx`)
- Create new tenure sessions
- Edit existing tenure details
- Close/archive old tenures
- View tenure history

### 2. **Structure Management** (`structure-tab.tsx`)
- Create and manage units (ministries, teams)
- View member counts per unit
- Assign leaders to units via modal

### 3. **Cabinet Management** (`cabinet-tab.tsx`)
Three sub-features:
- **Leadership List**: View all current appointments
- **Appointment View**: Search members and assign to positions
- **Configuration View**: Create and manage position types

### 4. **Family Management** (`family-tab.tsx`)
- Assign family names to entry years (e.g., 2023 → "Eagles")
- View family member counts

---

## 🔐 Security & Access Control

### Admin Email Whitelist
Access is restricted via the `ADMIN_EMAILS` environment variable:

```env
ADMIN_EMAILS="admin1@rcffuta.com,admin2@rcffuta.com"
```

### Authorization Flow
1. User navigates to `/dashboard/tenure`
2. `getAdminData()` calls `checkAdminAccess()`
3. Validates session token from cookies
4. Checks user email against whitelist
5. Returns admin client with service role permissions
6. If unauthorized, shows "Access Denied" message

---

## 🛠️ Key Components

### Main Dashboard (`page.tsx`)
- **State**: `activeTab` (tenure | structure | cabinet | families)
- **Data Loading**: Fetches all data on mount via `getAdminData()`
- **Refresh**: `onSuccess()` callback triggers full data reload
- **Navigation**: Tab buttons switch between feature views

### Tab Components
All tab components receive:
```typescript
{
  data: {
    activeTenure: Tenure | null,
    units: Unit[],
    families: ClassSet[],
    positions: Position[],
    leadership: Leadership[]
  },
  onSuccess: () => void  // Callback to refresh data
}
```

---

## 📊 Data Flow

### Loading Data
```
page.tsx (mount)
  → getAdminData()
  → checkAdminAccess()
  → Parallel fetch: [tenures, units, families, positions, leadership]
  → Transform & return data
  → setData(result)
```

### Mutation Flow
```
Component (form submit)
  → Server action (e.g., createTenureAction)
  → checkAdminAccess()
  → Database operation
  → revalidatePath('/dashboard/tenure')
  → Return { success, error? }
  → Component: onSuccess() → page.tsx: refresh()
```

---

## 🎨 UI Patterns

### Standard Form Components
All forms use standardized components:
- **FormInput**: Text/number inputs with consistent styling
- **FormSelect**: Dropdown selects with consistent styling
- **Icons**: lucide-react for visual consistency

### Responsive Design
- Mobile-first approach
- Tab navigation scrolls horizontally on mobile
- Forms stack on small screens
- Tables scroll horizontally when needed

### State Management
- Local component state (useState)
- Form data via FormData API
- No global state (data passed via props)

---

## 🔧 Common Tasks

### Adding a New Server Action

1. **Define action in `actions.ts`**:
```typescript
export async function myNewAction(formData: FormData) {
    const rcf = await checkAdminAccess();
    try {
        // Your logic here
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
```

2. **Import in component**:
```typescript
import { myNewAction } from "../actions";
```

3. **Use in component**:
```typescript
const handleSubmit = async (formData: FormData) => {
    const res = await myNewAction(formData);
    if (res.success) {
        onSuccess(); // Refresh data
    } else {
        alert("Error: " + res.error);
    }
};
```

4. **Document in `ACTIONS_REFERENCE.md`**

### Adding a New Tab

1. Create component file: `components/my-tab.tsx`
2. Import in `page.tsx`
3. Add tab button in navigation
4. Add conditional render in main content area
5. Pass `data` and `onSuccess` props

---

## 🐛 Debugging Tips

### Data Not Loading
- Check browser console for errors
- Verify `ADMIN_EMAILS` environment variable
- Check Network tab for failed requests
- Ensure user email matches whitelist

### Changes Not Reflecting
- Check if `revalidatePath` is called in action
- Verify `onSuccess()` is called after successful mutation
- Clear browser cache if using static data
- Check for console errors

### Authorization Issues
- Verify environment variable is set correctly
- Check cookies are being sent (Network tab)
- Ensure session token is valid
- Check server logs for auth errors

---

## 📝 Code Style Guidelines

### TypeScript
- Use `any` sparingly (currently suppressed via eslint comment)
- Add JSDoc comments for exported functions
- Use descriptive variable names

### React
- Functional components only
- Use hooks (useState, useEffect, useCallback)
- Extract reusable logic into custom hooks if needed

### Forms
- Use FormData API for submissions
- Validate required fields with HTML attributes
- Show user-friendly error messages

### Server Actions
- Always call `checkAdminAccess()` first
- Use try/catch for error handling
- Return consistent `{ success, error? }` format
- Call `revalidatePath()` after mutations

---

## 🚀 Future Improvements

### Potential Enhancements
- [ ] Add TypeScript types (replace `any`)
- [ ] Implement optimistic UI updates
- [ ] Add loading states for individual actions
- [ ] Implement undo/redo for critical operations
- [ ] Add audit log for admin actions
- [ ] Improve error handling with toast notifications
- [ ] Add bulk operations (assign multiple leaders)
- [ ] Implement search/filter in leadership list
- [ ] Add export functionality (CSV/PDF)
- [ ] Implement role-based permissions (beyond email whitelist)

### Performance Optimizations
- [ ] Implement React.memo for tab components
- [ ] Add pagination for large data sets
- [ ] Use React Query for caching
- [ ] Debounce all search inputs
- [ ] Lazy load tab components

---

## 📚 Related Documentation

- **Actions Reference**: See `ACTIONS_REFERENCE.md` for detailed action documentation
- **Database Schema**: Refer to Supabase schema documentation
- **RCF ICT Library**: Check `@rcffuta/ict-lib` for client methods

---

## 🤝 Contributing

When modifying this module:
1. Update relevant documentation
2. Follow existing code patterns
3. Test all affected actions
4. Update `ACTIONS_REFERENCE.md` if adding/changing actions
5. Ensure proper error handling
6. Add JSDoc comments for new functions

---

**Last Updated**: January 16, 2026
