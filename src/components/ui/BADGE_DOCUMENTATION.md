# Badge Component System Documentation

## Overview
The enhanced Badge component system provides a comprehensive, flexible, and type-safe way to display status indicators, labels, and metadata throughout the application.

## Components

### 1. Core Badge Component (`@/components/ui/badge`)

```tsx
import { Badge } from "@/components/ui/badge";

<Badge
  variant="success"
  size="sm"
  text="Active"
  icon="✅"
/>
```

#### Props
- `variant`: `"default" | "secondary" | "success" | "warning" | "info" | "error" | "purple" | "pink" | "orange" | "gray" | "outline"`
- `size`: `"sm" | "default" | "lg"`
- `text`: `string` - Badge text content
- `icon`: `React.ReactNode | string` - Icon (emoji or component)
- `children`: `React.ReactNode` - Alternative to text prop
- `className`: `string` - Additional CSS classes

#### Variants
- **default**: Neutral gray styling
- **success**: Green for positive states
- **warning**: Yellow for caution states
- **info**: Blue for informational content
- **error**: Red for error states
- **purple**: Purple accent
- **pink**: Pink accent
- **orange**: Orange accent
- **gray**: Muted gray
- **outline**: Transparent background with border

### 2. Badge Group Component (`@/components/ui/badge-group`)

```tsx
import { BadgeGroup } from "@/components/ui/badge-group";

<BadgeGroup spacing="normal">
  <Badge variant="success" text="Active" icon="✅" />
  <Badge variant="info" text="Member" icon="👤" />
</BadgeGroup>
```

#### Props
- `spacing`: `"tight" | "normal" | "loose"` - Controls spacing between badges
- `className`: `string` - Additional CSS classes

### 3. Utility Badge Components

#### CountBadge
```tsx
import { CountBadge } from "@/components/ui/badge-group";

<CountBadge count={25} label="items" />
// Renders: "25 items" with number icon
```

#### StatusBadge
```tsx
import { StatusBadge } from "@/components/ui/badge-group";

<StatusBadge status="Online" variant="online" />
<StatusBadge status="Processing" variant="pending" />
```

#### FilterBadge
```tsx
import { FilterBadge } from "@/components/ui/badge-group";

<FilterBadge
  isActive={isFiltered}
  label="Filtered"
  onClear={() => clearFilter()}
/>
```

#### MembershipBadge
```tsx
import { MembershipBadge } from "@/components/ui/badge-group";

<MembershipBadge
  isMember={user.isRcfMember}
  memberLabel="Member"
  guestLabel="Guest"
/>
```

#### GenderBadge
```tsx
import { GenderBadge } from "@/components/ui/badge-group";

<GenderBadge gender="Male" />
// Automatically shows appropriate icon and color
```

## Usage Examples

### Question Tab Implementation
```tsx
// Header with count and filter indicator
<BadgeGroup spacing="normal">
  <CountBadge
    count={filteredQuestions.length}
    label={`of ${questionsData.length}`}
  />
  <FilterBadge
    isActive={!!questionsSearch}
    label="Filtered"
    onClear={() => setQuestionsSearch('')}
  />
</BadgeGroup>

// User status badges
<BadgeGroup spacing="tight">
  <MembershipBadge isMember={user.is_rcf_member} />
  {user.checked_in_at && (
    <StatusBadge status="Checked In" variant="success" />
  )}
  {user.gender && (
    <GenderBadge gender={user.gender} />
  )}
</BadgeGroup>
```

### Custom Styling
```tsx
<Badge
  variant="success"
  size="lg"
  text="Premium User"
  icon="⭐"
  className="font-bold shadow-lg"
/>
```

## Design System Integration

### Color Palette
- **Success**: Green (`bg-green-100 text-green-800`)
- **Warning**: Yellow (`bg-yellow-100 text-yellow-800`)
- **Info**: Blue (`bg-blue-100 text-blue-800`)
- **Error**: Red (`bg-red-100 text-red-800`)
- **Purple**: Purple (`bg-purple-100 text-purple-800`)
- **Pink**: Pink (`bg-pink-100 text-pink-800`)
- **Orange**: Orange (`bg-orange-100 text-orange-800`)
- **Gray**: Gray (`bg-gray-100 text-gray-800`)

### Accessibility
- All badges include proper contrast ratios
- Icon and text provide dual information channels
- Hover states for interactive badges
- Focus states for clickable badges

## Best Practices

1. **Use semantic variants**: Choose variants that match the meaning (success for positive, warning for caution)
2. **Group related badges**: Use BadgeGroup for multiple related badges
3. **Choose appropriate sizes**: Use `sm` for dense layouts, `lg` for emphasis
4. **Meaningful icons**: Select icons that reinforce the badge meaning
5. **Consistent spacing**: Use BadgeGroup spacing options for uniformity

## Migration from Old Badge

### Before
```tsx
<Badge
  variant="secondary"
  className="bg-blue-100 text-blue-800"
>
  {count} items
</Badge>
```

### After
```tsx
<CountBadge count={count} label="items" />
// or
<Badge
  variant="info"
  size="sm"
  text={`${count} items`}
  icon="📊"
/>
```

## Performance Considerations
- Utility components reduce repetitive code
- Consistent styling reduces CSS bundle size
- Type safety prevents runtime errors
- Semantic variants improve maintainability
