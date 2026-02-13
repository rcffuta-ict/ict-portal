# Q/A System for Events

This module provides a comprehensive Question & Answer system for RCF events with scripture reference support, admin moderation, and question clustering capabilities.

## Features

- **Event-based Questions**: Questions are linked to specific events
- **Scripture References**: Built-in support for Bible verse references
- **Admin Moderation**: Hide/show questions, provide answers
- **Question Flagging**: Community-driven content moderation
- **Question Clustering**: Group similar questions together
- **Full-text Search**: Search questions by content and scripture references
- **Anonymous Support**: Allow anonymous questions with display names

## Database Setup

Run the SQL script to set up the necessary tables:

```sql
-- Run this in your Supabase SQL editor
\i supabase/qa-init.sql
```

This creates:

- `event_questions` - Main questions table
- `question_flags` - Flagging system
- `question_references` - Question clustering/referencing
- Views and functions for enhanced functionality

## Usage

### Basic Setup

```typescript
import { QAService } from "@rcffuta/ict-lib";

const qaService = new QAService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
);
```

### Creating Questions

```typescript
// Create a question for an event
const questionResponse = await qaService.createQuestion({
    event_id: "event-uuid",
    question_text: "What does it mean to be born again?",
    scripture_reference: "John 3:3-7",
    asker_name: "Anonymous", // For anonymous questions
    asked_by_profile_id: "user-uuid", // For registered users
});

if (questionResponse.data) {
    console.log("Question created:", questionResponse.data);
} else {
    console.error("Error:", questionResponse.error);
}
```

### Fetching Event Questions

```typescript
// Get all questions for an event
const questionsResponse = await qaService.getEventQuestions("event-uuid", {
    status: ["visible", "answered"], // Filter by status
    limit: 20,
    offset: 0,
});

// Search questions
const searchResponse = await qaService.searchQuestions({
    search_term: "born again",
    event_id_filter: "event-uuid",
});
```

### Admin Operations

```typescript
// Answer a question (admin only)
await qaService.answerQuestion(
    "question-uuid",
    "Being born again means accepting Jesus Christ as your Lord and Savior...",
    "admin-profile-uuid",
);

// Hide a question
await qaService.toggleQuestionVisibility({
    question_id: "question-uuid",
    new_status: "hidden",
});

// Cluster similar questions
await qaService.clusterQuestions({
    question_ids: ["question1-uuid", "question2-uuid", "question3-uuid"],
});
```

### Flagging System

```typescript
// Flag inappropriate content
await qaService.flagQuestion({
    question_id: "question-uuid",
    reason: "inappropriate_content",
    description: "Contains offensive language",
    flagged_by_name: "Concerned Member",
});

// View flagged questions (admin only)
const flaggedResponse = await qaService.getFlaggedQuestions();

// Resolve a flag
await qaService.resolveFlag(
    "flag-uuid",
    "admin-profile-uuid",
    "Reviewed and found appropriate",
);
```

### Question Statistics

```typescript
const stats = await qaService.getQuestionStats("event-uuid");
console.log(`Total: ${stats.total}, Answered: ${stats.answered}`);
```

## Data Types

### Question Status

- `visible` - Question is public
- `hidden` - Hidden by admin (only admin can see)
- `answered` - Question has been answered
- `flagged` - Question is flagged for review

### Flag Reasons

- `inappropriate_content` - Offensive or unsuitable content
- `off_topic` - Not related to the event theme
- `duplicate` - Same question already asked
- `spam` - Spam or promotional content
- `personal_attack` - Attacking individuals
- `false_doctrine` - Contradicts biblical teaching
- `other` - Other reasons (specify in description)

### Reference Types

- `duplicate` - Questions asking the same thing
- `related` - Similar topics or themes
- `follow_up` - Follow-up questions
- `clarification` - Questions seeking clarification

## Scripture References

The system supports various scripture reference formats:

- Single verse: `"John 3:16"`
- Verse range: `"Romans 8:28-30"`
- Multiple references: `"John 3:16, Romans 8:28"`
- Chapter: `"Psalm 23"`

References are indexed for full-text search and displayed prominently with questions.

## Security & Permissions

### Row Level Security (RLS)

- **Questions**: Users can only see visible/answered questions + their own
- **Flags**: Anyone can flag, only admins can view/manage
- **References**: Public read, admin write

### Admin Permissions

Admins are identified by having active leadership positions with category:

- `PRESIDENT` - Organization president
- `CENTRAL` - Central executive positions

### Anonymous Questions

- Supported through optional `asker_name` field
- No authentication required for question submission
- Useful for sensitive or personal questions

## Advanced Features

### Question Clustering

Group related questions together for better organization:

```typescript
// Auto-cluster similar questions
const clusterId = await qaService.clusterQuestions({
    question_ids: relatedQuestionIds,
});

// Get all questions in a cluster
const cluster = await qaService.getQuestionCluster(clusterId);
```

### Full-text Search

Powered by PostgreSQL's full-text search capabilities:

```typescript
const results = await qaService.searchQuestions({
    search_term: "salvation born again",
    event_id_filter: "event-uuid",
});
```

### Question References

Link questions to show relationships:

```typescript
await qaService.createQuestionReference({
    main_question_id: "main-question-uuid",
    referenced_question_id: "related-question-uuid",
    reference_type: "related",
    note: "Both questions discuss salvation themes",
});
```

## Best Practices

1. **Scripture References**: Always encourage scripture references for doctrinal questions
2. **Moderation**: Regularly review flagged content and respond promptly
3. **Clustering**: Group similar questions to avoid redundancy
4. **Search**: Use descriptive keywords for better searchability
5. **Anonymity**: Respect anonymous questions and maintain confidentiality

## API Reference

See the TypeScript interfaces in `src/types/qa.type.ts` for complete API documentation.

## Contributing

When extending the Q/A system:

1. Update the database schema if needed
2. Add corresponding TypeScript types
3. Update the service methods
4. Add appropriate tests
5. Update this documentation

## Support

For questions about implementation or biblical content moderation guidelines, contact the ICT team or pastoral leadership.
