# Unit Positions Feature Documentation

> **Date:** 2026-02-06
> **Library:** `ict-lib`
> **Affected Tables:** `unit_positions` (new), `leadership`, `leadership_positions`, `units`

---

## Overview

This update introduces the ability to **assign leadership positions to units**, designating one position as the **leader** and others as **assistants**. When a person is assigned to that position (via the `leadership` table) for a tenure, they automatically become the unit's leader or assistant for that tenure.

### Key Concepts

| Concept                   | Description                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Unit**                  | A ministry unit or team (e.g., Drama, Choir, Ushering)                                          |
| **Leadership Position**   | A role title (e.g., "Drama Coordinator", "Assistant Choir Director")                            |
| **Unit Position**         | The **link** between a position and a unit, specifying if it's the `leader` or `assistant` role |
| **Leadership Assignment** | When a person (profile) occupies a position for a specific tenure                               |

---

## Database Schema

### New Table: `unit_positions`

```sql
CREATE TABLE public.unit_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.leadership_positions(id) ON DELETE CASCADE,
    role_type unit_role_type NOT NULL DEFAULT 'assistant',  -- 'leader' | 'assistant'
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (unit_id, position_id)  -- A position can only be assigned once per unit
);

-- Constraint: Only ONE leader per unit
CREATE UNIQUE INDEX unit_positions_one_leader_per_unit
ON public.unit_positions (unit_id)
WHERE role_type = 'leader';
```

### New Enum: `unit_role_type`

```sql
CREATE TYPE unit_role_type AS ENUM ('leader', 'assistant');
```

---

## TypeScript Types

### New Types in `src/types/exco.type.ts`

```typescript
// Unit position role types
export type UnitRoleType = 'leader' | 'assistant'

// Links a leadership position to a unit with a designated role
export interface UnitPosition {
    id: string
    unitId: string
    positionId: string
    roleType: UnitRoleType
    createdAt?: string
}

// Extended type with joined data for queries
export interface UnitPositionWithDetails extends UnitPosition {
    position?: LeadershipPosition
    unit?: {
        id: string
        name: string
        type: 'UNIT' | 'TEAM'
        description?: string
    }
}
```

---

## API Methods (UnitService)

All methods are available via `UnitService` from `ict-lib`.

### 1. Get Unit Positions

**Method:** `getUnitPositions(unitId: string)`

Returns all leadership positions assigned to a unit.

```typescript
const unitService = new UnitService(supabaseClient)

const positions = await unitService.getUnitPositions('unit-uuid')
// Returns:
// [
//   { id: '...', role_type: 'leader', position: { id, title, category, description } },
//   { id: '...', role_type: 'assistant', position: { ... } }
// ]
```

---

### 2. Assign Position to Unit

**Method:** `assignPositionToUnit(unitId: string, positionId: string, roleType: 'leader' | 'assistant')`

Assigns a leadership position to a unit as either leader or assistant.

```typescript
// Assign as leader
await unitService.assignPositionToUnit(
    'drama-unit-uuid',
    'drama-coordinator-position-uuid',
    'leader',
)

// Assign as assistant
await unitService.assignPositionToUnit(
    'drama-unit-uuid',
    'asst-drama-coordinator-position-uuid',
    'assistant',
)
```

**Error Handling:**

- Throws `"This unit already has a leader position assigned."` if trying to add a second leader
- Throws `"This position is already assigned to this unit."` if duplicate assignment

---

### 3. Remove Position from Unit

**Method:** `removePositionFromUnit(unitPositionId: string)`

Removes a position assignment from a unit.

```typescript
await unitService.removePositionFromUnit('unit-position-uuid')
```

---

### 4. Get Unit Leadership (All Leaders & Assistants)

**Method:** `getUnitLeadership(unitId: string, tenureId: string)`

Gets all people currently occupying leader/assistant positions for a unit in a specific tenure.

```typescript
const leadership = await unitService.getUnitLeadership(
    'drama-unit-uuid',
    'tenure-uuid',
)
// Returns:
// [
//   {
//     unitPositionId: '...',
//     roleType: 'leader',
//     positionTitle: 'Drama Coordinator',
//     positionId: '...',
//     leadershipId: '...',
//     profile: { id, first_name, last_name, email, phone_number, avatar_url }
//   },
//   {
//     roleType: 'assistant',
//     positionTitle: 'Assistant Drama Coordinator',
//     profile: { ... }
//   }
// ]
```

---

### 5. Get Unit Leader (Convenience)

**Method:** `getUnitLeader(unitId: string, tenureId: string)`

Gets just the leader of a unit for a specific tenure.

```typescript
const leader = await unitService.getUnitLeader('drama-unit-uuid', 'tenure-uuid')
// Returns:
// {
//   positionTitle: 'Drama Coordinator',
//   profile: { id, first_name, last_name, email, phone_number, avatar_url }
// }
// or null if no leader assigned
```

---

## Frontend Integration Guide

### Step 1: Run the Migration

Apply the SQL migration in Supabase:

```bash
# Via Supabase CLI
supabase db push

# Or run manually in SQL Editor
# Copy contents of: supabase/unit-positions.sql
```

### Step 2: Update ict-lib

```bash
pnpm update ict-lib
# or
npm update ict-lib
```

### Step 3: Admin UI - Assign Positions to Units

Create an admin interface to manage unit position assignments:

```tsx
// Example: Admin page to manage unit positions
'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { UnitService } from 'ict-lib'

export default function ManageUnitPositions({ unitId }: { unitId: string }) {
    const { supabase } = useSupabase()
    const unitService = new UnitService(supabase)

    const [positions, setPositions] = useState([])
    const [availablePositions, setAvailablePositions] = useState([])

    useEffect(() => {
        loadPositions()
    }, [unitId])

    async function loadPositions() {
        const data = await unitService.getUnitPositions(unitId)
        setPositions(data)
    }

    async function handleAssign(
        positionId: string,
        roleType: 'leader' | 'assistant',
    ) {
        try {
            await unitService.assignPositionToUnit(unitId, positionId, roleType)
            await loadPositions()
        } catch (error) {
            alert(error.message)
        }
    }

    async function handleRemove(unitPositionId: string) {
        await unitService.removePositionFromUnit(unitPositionId)
        await loadPositions()
    }

    return (
        <div>
            <h2>Unit Position Assignments</h2>

            {/* Current assignments */}
            <ul>
                {positions.map(up => (
                    <li key={up.id}>
                        <span
                            className={
                                up.role_type === 'leader' ? 'font-bold' : ''
                            }
                        >
                            {up.position.title} ({up.role_type})
                        </span>
                        <button onClick={() => handleRemove(up.id)}>
                            Remove
                        </button>
                    </li>
                ))}
            </ul>

            {/* Add new assignment */}
            <select onChange={e => handleAssign(e.target.value, 'assistant')}>
                <option>Select position to add...</option>
                {availablePositions.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.title}
                    </option>
                ))}
            </select>
        </div>
    )
}
```

### Step 4: Display Unit Leadership

Show who leads each unit:

```tsx
// Example: Display unit leader and assistants
'use client'

import { useEffect, useState } from 'react'
import { UnitService } from 'ict-lib'

export function UnitLeadershipCard({ unitId, tenureId }: Props) {
    const [leadership, setLeadership] = useState([])

    useEffect(() => {
        const unitService = new UnitService(supabase)
        unitService.getUnitLeadership(unitId, tenureId).then(setLeadership)
    }, [unitId, tenureId])

    const leader = leadership.find(l => l.roleType === 'leader')
    const assistants = leadership.filter(l => l.roleType === 'assistant')

    return (
        <div className='card'>
            {leader && (
                <div className='leader'>
                    <Avatar src={leader.profile.avatar_url} />
                    <div>
                        <p className='font-bold'>
                            {leader.profile.first_name}{' '}
                            {leader.profile.last_name}
                        </p>
                        <p className='text-sm text-gray-500'>
                            {leader.positionTitle}
                        </p>
                    </div>
                </div>
            )}

            {assistants.length > 0 && (
                <div className='assistants'>
                    <h4>Assistants</h4>
                    {assistants.map(a => (
                        <div key={a.unitPositionId}>
                            {a.profile.first_name} {a.profile.last_name} -{' '}
                            {a.positionTitle}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

---

## Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│     units       │     │   unit_positions    │     │  leadership_ │
│                 │◄────┤                     │────►│  positions   │
│  id, name, type │     │  unit_id            │     │              │
└─────────────────┘     │  position_id        │     │ id, title,   │
                        │  role_type          │     │ category     │
                        │  ('leader'|'asst')  │     └──────────────┘
                        └──────────┬──────────┘              │
                                   │                         │
                                   │ defines which           │
                                   │ positions belong        │
                                   │ to unit                 │
                                   ▼                         │
                        ┌──────────────────────┐            │
                        │     leadership       │◄───────────┘
                        │                      │
                        │  profile_id ─────────┼──► profiles (person)
                        │  position_id         │
                        │  unit_id             │
                        │  tenure_id           │
                        └──────────────────────┘
                                   │
                                   ▼
                          "Who leads Unit X
                           in Tenure Y?"
```

---

## Constraints & Business Rules

| Rule                                                        | Enforcement                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| Each unit can have **only ONE leader** position             | Partial unique index on `(unit_id) WHERE role_type = 'leader'` |
| Each unit can have **multiple assistant** positions         | No limit enforced                                              |
| A position can only be assigned to a unit **once**          | Unique constraint on `(unit_id, position_id)`                  |
| Deleting a unit cascades to delete its position assignments | `ON DELETE CASCADE`                                            |
| Deleting a position cascades to delete its unit assignments | `ON DELETE CASCADE`                                            |

---

## Migration Checklist

- [ ] Run `supabase/unit-positions.sql` in production
- [ ] Update `ict-lib` package in frontend
- [ ] Add admin UI to assign positions to units
- [ ] Update unit detail pages to show leadership
- [ ] Test assigning leader (should allow only one)
- [ ] Test assigning multiple assistants
- [ ] Test removing position assignments
- [ ] Test querying unit leadership for a tenure
