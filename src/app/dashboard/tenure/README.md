# Tenure Dashboard Module

A comprehensive administrative interface for managing RCF fellowship tenures, organizational structure, leadership appointments, and family assignments.

---

## 📁 File Structure

```
src/app/dashboard/tenure/
├── page.tsx                    # Main dashboard page (tab navigation)
├── layout.tsx                  # Section title (keeps the title template for children)
├── actions.ts                  # Server actions for all operations
├── handover/page.tsx           # Handover ledger (history + start/resume)
├── handover/[intentId]/page.tsx # The wizard, or a finished handover's record
├── backup/route.ts             # Backup download (SysAdmin / VP Admin)
├── ACTIONS_REFERENCE.md        # Detailed action documentation
├── README.md                   # This file
└── components/
    ├── tenure-tab.tsx          # Tenure creation, editing, closure
    ├── structure-tab.tsx       # Units/teams management
    ├── cabinet-tab.tsx         # Leadership appointments & positions
    ├── family-tab.tsx          # Entry year family naming
    ├── transfers-tab.tsx       # Unit transfer queue (VP Admin decides)
    ├── catalogue-panel.tsx     # Read-only hierarchy + catalogue sync
    ├── handover-index.tsx      # Ledger: open intent + history
    ├── handover-record.tsx     # Read-only record of a finished handover
    ├── handover-wizard.tsx     # The six-step handover
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

> **The `ADMIN_EMAILS` whitelist described in earlier versions of this file no longer
> exists.** Access is derived from leadership positions and their privilege tags.

Three gates, narrowest last:

| Gate | Who passes | Guards |
|---|---|---|
| `requireModuleRead("tenure")` | whoever the `module_access` config grants (default CENTRAL), plus admins | reading the console |
| `requireModuleWrite("tenure")` | the configured write tags, plus SysAdmin/VP Admin | appointing people, creating units, the handover |
| `requireVpAdmin()` | VP Admin + System Admin only | the leadership catalogue, unit transfer decisions |

The distinction that matters: tenure-write lets you put people **into** positions;
only the VP Admin can change what the positions **are**.

### Authorization Flow
1. User navigates to `/dashboard/tenure`
2. `getAdminData()` calls `checkAdminAccess()`
3. Validates session token from cookies
4. Checks user email against whitelist
5. Returns admin client with service role permissions
6. If unauthorized, shows "Access Denied" message

---

## 🏛 The leadership catalogue

The org chart — President → VPs → Executives → Level Coordinators — lives in
`src/config/leadership-positions.ts` and is seeded by migration 0011. It is **frozen in
the sense that it is the same every tenure**: handing over swaps the people in
`leadership`, never the positions. The VP Admin can still edit it when the fellowship
genuinely restructures (`requireVpAdmin()` gates every catalogue action); a protected
position can be deactivated but never deleted, enforced by a DB trigger, because
appointments and `module_access` reference these rows by id.

Executive positions are generated one per unit, so creating a unit mints its Exco
position automatically. Level Coordinators are generated one per level — and the
**500-Level coordinator holds `LEVEL:all` rather than `LEVEL:500`**, which is how
finalist coordinators get authority over every level. That rule lives in data, not in an
`if` branch, because `canManageLevel()` already reads an `all` scope as
"every generation".

---

## 🔄 Handover

A handover advances the session, and **that alone re-levels the whole fellowship** — a
member's level is computed from their generation's entry year against the active
tenure's session (`rcf_compute_level` / `computeLevel`), never stored. So the wizard
*previews* the progression rather than migrating anything.

**VP Admin and System Admin only** (`requireVpAdmin`) — narrower than the rest of the
module, which the wider tenure-write group can use.

### The ledger — `/dashboard/tenure/handover`

Not the wizard. An index of every handover ever attempted, backed by
`handover_intents` (migration 0012). It does two things:

- **Start or resume.** An open intent is pulled to the top with a progress bar and a
  "Resume" button. The wizard saves after every step, so closing the tab loses nothing.
  A partial unique index allows only one open intent per outgoing tenure, and starting
  a second time *joins* the existing one rather than racing it.
- **Show the history.** The people most affected by a handover — the incoming cabinet —
  arrive after it happened. Each row links to a read-only record: who ran it, what they
  decided at each step, and how it ended. `handover_events` is the append-only
  proceedings log behind that timeline; nothing in the app updates or deletes those rows.

### The wizard — `/dashboard/tenure/handover/[intentId]`

A **full-screen** six-step walk-through: back up (required — the action refuses without
a recorded backup for *this* tenure), name the incoming tenure, read the progression,
appoint the VP Admin + ICT Coordinator, decide whether to carry unit membership forward
and whether to revoke outgoing logins, then type the incoming session to confirm. It
deliberately covers the dashboard chrome — there is nothing else to click and no
backdrop to dismiss by accident. A completed or abandoned intent renders at the same URL
as a record instead of a form.

`payload` on the intent is wizard DRAFT state and is never trusted: the commit action
re-reads and re-validates everything from the database regardless of what the draft holds.

---

## 💾 Backups

`/dashboard/tenure/backup` (System Admin or VP Admin only). Driven by
`src/components/dashboard/backup-picker.tsx`, which is shared — the handover wizard
embeds it, and it stands alone anywhere else a backup is offered.

- **Per tenure.** Tables with a `tenure_id` are filtered to the selected tenure; shared
  tables (profiles, units, generations) come whole.
- **Required vs optional.** Identity and structure tables are always included — a bundle
  without them can't restore. Audit, invite and activity tables are opt-in. The registry
  is `src/lib/backup-tables.ts`, shared by the picker and validated by the server.
- **Handover history travels with it.** `handover_intents` and `handover_events` are
  included by default and, unlike every other audit table, are *not* tenure-scoped: a
  backup taken mid-handover that held only the handover in progress would lose exactly
  the chain of custody it exists to preserve.
- **Two formats.** JSON restores; CSV downloads as a ZIP of one spreadsheet per table
  for reading (CSV loses types and relationships, so it can't be restored from). The ZIP
  is written by `src/lib/zip.ts` — store-only, no new dependency.
- **Encrypted** with AES-256-GCM, key derived by scrypt. The default passphrase is the
  tenure president's name, slugged: `Ada Obi`, `ADA  OBI` and `ada-obi` all unlock it. A
  custom passphrase is offered and is stronger — a name is guessable by anyone who knows
  the fellowship, so it guards against casual disclosure, not a determined attacker.
  Locked files carry the `.rcfvault` extension; the filename includes the tenure name,
  its theme and the session.
- **Secrets never enter the file**: no password hashes, no session tokens, invite tokens
  redacted. After a restore, leaders set a new password on first login.

Restore with `node scripts/restore-backup.mjs <file> --password "<passphrase>"` —
dry-run by default, `--commit` to write.

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
- Check Network tab for failed requests
- Confirm the signed-in profile holds a position whose privilege tags satisfy the
  `tenure` module's read config (Settings → Module Access), or is an admin

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
