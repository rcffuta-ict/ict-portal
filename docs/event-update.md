# Frontend Implementation Guide: Recurring & Exclusive Events

## 1. Update Supabase Types

First, updated event type

```typescript
export interface Event {
    id: string;
    slug: string;
    title: string;
    description?: string;
    date: string;
    isActive: boolean;
    // New fields
    isRecurring: boolean;
    isExclusive: boolean;
}
```

## 2. Update Event Service

Update the service methods to fetch these new fields.

**File:** `src/services/event.service.ts`

```typescript
// Update getEventBySlug / getEventById selects to include new columns if you aren't using '*'
// .select('*, is_recurring, is_exclusive')

// Add a method to get taggable events (Active Upcoming + Recurring)
async getTaggableEvents() {
    const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .or(`date.gte.${new Date().toISOString()},is_recurring.eq.true`)
        .eq('is_active', true)
        .order('is_recurring', { ascending: false }) // Put recurring first
        .order('date', { ascending: true })

    return { data, error }
}
```

## 3. UI Updates (Next.js Portal)

### A. Question Asking / Event Tagging

When a user asks a question and needs to select an event:

- **Fetch Logic**: Use the query above to get both upcoming events AND recurring generic events.
- **Display**:
    - Group events in the dropdown/modal: "Recurring Events" (Bible Study, etc.) vs "Upcoming Events".
    - If `is_exclusive` is true, display a badge (e.g., "🔒 Exclusive") or restricted icon next to the name.

### B. Admin Dashboard

- **Create/Edit Event Form**:
    - Add a Checkbox/Switch for "Recurring Event".
    - Add a Checkbox/Switch for "Exclusive Event".
    - If "Recurring" is checked, the "Date" field might be disabled or hidden (or labeled as "Start Date" purely for ordering).

### C. Event Filtering

- When filtering questions by event, ensure the recurring event slugs (`bible-study`, `prayer-meeting`) are always available as filter options, regardless of date range.
