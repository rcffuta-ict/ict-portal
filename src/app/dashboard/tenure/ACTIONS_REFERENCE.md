# Tenure Dashboard Actions Reference

This document provides a clear overview of all server actions used in the Tenure Dashboard and their usage.

---

## 📋 Table of Contents
1. [Data Fetching](#data-fetching)
2. [Tenure Management](#tenure-management)
3. [Structure Management](#structure-management)
4. [Leadership & Cabinet](#leadership--cabinet)
5. [Action Usage Map](#action-usage-map)

---

## 🔍 Data Fetching

### `getAdminData()`
**Purpose**: Fetches all data needed for the tenure dashboard  
**Returns**: 
```typescript
{
  activeTenure: Tenure | null,
  units: Unit[],
  families: ClassSet[],
  positions: Position[],
  leadership: Leadership[],
  authorized: boolean
}
```
**Used in**: 
- `page.tsx` - Main dashboard page (loads on mount and refresh)

**Security**: Checks admin email whitelist via `checkAdminAccess()`

---

## 📅 Tenure Management

### `createTenureAction(formData: FormData)`
**Purpose**: Creates a new tenure and deactivates all others  
**FormData Fields**:
- `name` - Tenure name (e.g., "2024/2025")
- `session` - Session name (e.g., "Session 2024")
- `startDate` - Start date (ISO string)

**Used in**: `tenure-tab.tsx` - "Create Tenure" form  
**Returns**: `{ success: boolean, error?: string }`

---

### `updateTenureAction(formData: FormData)`
**Purpose**: Updates an existing tenure's name/session  
**FormData Fields**:
- `id` - Tenure ID
- `name` - New tenure name
- `session` - New session name

**Used in**: `tenure-tab.tsx` - "Edit Tenure" modal  
**Returns**: `{ success: boolean, error?: string }`

---

### `closeTenureAction(tenureId: string)`
**Purpose**: Closes/ends a tenure (sets `is_active = false`, adds `end_date`)  
**Used in**: `tenure-tab.tsx` - "Close Tenure" button  
**Returns**: `{ success: boolean, error?: string }`

---

## 🏗️ Structure Management

### `createUnitAction(formData: FormData)`
**Purpose**: Creates a new unit (ministry/team)  
**FormData Fields**:
- `name` - Unit name (e.g., "Choir", "Welfare Team")
- `type` - "UNIT" or "TEAM"

**Used in**: `structure-tab.tsx` - "Add Unit" form  
**Returns**: `{ success: boolean, error?: string }`

---

### `nameFamilyAction(formData: FormData)`
**Purpose**: Assigns a family name to an entry year (e.g., 2023 → "Eagles")  
**FormData Fields**:
- `entryYear` - Entry year (number)
- `familyName` - Family name (e.g., "Eagles")

**Used in**: `family-tab.tsx` - "Name Family" form  
**Returns**: `{ success: boolean, error?: string }`

---

### `getUnitDetails(unitId: string)`
**Purpose**: Fetches leaders assigned to a specific unit  
**Returns**: `{ leaders: Leadership[] }`  
**Used in**: `manage-unit-modal.tsx` - Loads unit leadership on modal open

---

## 👑 Leadership & Cabinet

### `searchMemberAction(query: string)`
**Purpose**: Searches for members by name/email/phone (for assigning leadership)  
**Returns**: Array of user profiles with units/teams  
**Used in**:
- `cabinet-tab.tsx` - Search bar in appointment view
- `manage-unit-modal.tsx` - Search in "Add Leader" form

**Debounced**: Yes (300ms in `cabinet-tab.tsx`)

---

### `createPositionAction(formData: FormData)`
**Purpose**: Creates a new leadership position (role)  
**FormData Fields**:
- `title` - Position title (e.g., "President")
- `category` - "GENERAL" | "UNIT" | "LEVEL"
- `description` - Optional role description

**Used in**: `cabinet-tab.tsx` - "Create New Role" form (ConfigurationView)  
**Returns**: `{ success: boolean, error?: string }`

---

### `togglePositionAction(id: string, currentStatus: boolean, data: any)`
**Purpose**: Activates/deactivates a position  
**Used in**: `cabinet-tab.tsx` - Toggle switch in positions list  
**Returns**: `{ success: boolean, error?: string }`

---

### `assignLeaderAction(formData: FormData)`
**Purpose**: Assigns a member to a leadership position  
**FormData Fields**:
- `tenureId` - Active tenure ID
- `profileId` - Member's profile ID
- `positionId` - Position ID
- `unitId` - Optional (for UNIT category positions)
- `classSetId` - Optional (for LEVEL category positions)

**Used in**: `cabinet-tab.tsx` - "Appoint Leader" form  
**Returns**: `{ success: boolean, error?: string }`

---

### `addUnitLeaderAction(formData: FormData)`
**Purpose**: Wrapper for `assignLeaderAction` that auto-fills tenure and unit  
**FormData Fields**:
- `profileId` - Member's profile ID
- `positionId` - Position ID
- `unitId` - Unit ID (auto-filled from modal context)

**Used in**: `manage-unit-modal.tsx` - "Add Leader" form  
**Returns**: `{ success: boolean, error?: string }`

---

### `removeUnitLeaderAction(id: string)`
**Purpose**: Removes a leadership assignment  
**Used in**: `manage-unit-modal.tsx` - Delete button in leaders list  
**Returns**: `{ success: boolean, error?: string }`

---

## 🗺️ Action Usage Map

| Component | Actions Used |
|-----------|-------------|
| **page.tsx** | `getAdminData` |
| **tenure-tab.tsx** | `createTenureAction`, `updateTenureAction`, `closeTenureAction` |
| **structure-tab.tsx** | `createUnitAction` |
| **family-tab.tsx** | `nameFamilyAction` |
| **cabinet-tab.tsx** | `searchMemberAction`, `createPositionAction`, `togglePositionAction`, `assignLeaderAction` |
| **manage-unit-modal.tsx** | `getUnitDetails`, `searchMemberAction`, `addUnitLeaderAction`, `removeUnitLeaderAction` |

---

## 🔒 Security Notes

All actions use `checkAdminAccess()` which:
1. Validates session token from cookies
2. Checks user email against `ADMIN_EMAILS` environment variable
3. Returns admin client with elevated permissions

**Environment Variable Required**:
```env
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
```

---

## 🔄 Revalidation

All mutation actions call `revalidatePath('/dashboard/admin')` to refresh cached data.

The main page calls `refresh()` after successful operations to reload all data via `getAdminData()`.

---

## ⚠️ Unused/Commented Actions

- `revokeLeaderAction` - Commented out in `cabinet-tab.tsx` (use `removeUnitLeaderAction` instead)
