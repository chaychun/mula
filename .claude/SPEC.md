# Chat-First Exercise UI Specification

## Overview

Replace the current dual-pane layout (chat + code editor) with a unified chat-first experience where exercises appear as an expandable panel attached to the chat input. This creates a more conversational learning flow where exercises feel like part of the dialogue rather than a separate workspace.

## Core Concept

- **Remove**: Main code editor pane
- **Keep**: Sidebar (projects/sessions navigation)
- **Add**: Sticky exercise panel above chat input
- **Modify**: AI prompts to generate shorter, atomic exercises

---

## User Experience Flow

### 1. Normal Chat State

```
┌─────────────────────────────────────┐
│           Chat Messages             │
│                                     │
│  [AI]: Let me explain recursion...  │
│  [User]: Can you give me practice?  │
│  [AI]: Sure! Here's an exercise...  │
│         [Tool: create_exercise]     │
│  [AI]: Give it a try!               │
│                                     │
├─────────────────────────────────────┤
│  [Chat input box]            [Send] │
└─────────────────────────────────────┘
```

### 2. Active Exercise State

When AI creates an exercise via tool call, the exercise panel appears:

```
┌─────────────────────────────────────┐
│           Chat Messages             │
│           (scrollable)              │
├─────────────────────────────────────┤
│ ▼ Exercise: Calculate Factorial     │  ← Collapsible header
│ ┌─────────────────────────────────┐ │
│ │ Instructions:                   │ │
│ │ Fill in the blank to complete   │ │
│ │ the factorial function.         │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ function factorial(n) {         │ │  ← Monaco editor
│ │   if (n <= 1) return ___;       │ │
│ │   return n * ___;               │ │
│ │ }                               │ │
│ └─────────────────────────────────┘ │
│ [Reset] [Skip]           [Submit]   │
├─────────────────────────────────────┤
│  [Chat input box]            [Send] │
└─────────────────────────────────────┘
```

### 3. Collapsed Exercise State (for more chat visibility)

User can collapse the exercise panel while keeping it active:

```
┌─────────────────────────────────────┐
│           Chat Messages             │
│           (more space now)          │
├─────────────────────────────────────┤
│ ► Exercise: Calculate Factorial     │  ← Click to expand
├─────────────────────────────────────┤
│  [Chat input box]            [Send] │
└─────────────────────────────────────┘
```

### 4. After Submission

Exercise disappears from sticky section and appears as a user message bubble:

````
┌─────────────────────────────────────┐
│           Chat Messages             │
│                                     │
│  [User]: ┌────────────────────────┐ │
│          │ ✓ Calculate Factorial  │ │  ← Exercise submission card
│          │ Fill in factorial...   │ │
│          │ ```javascript          │ │
│          │ function factorial(n)  │ │
│          │ ...                    │ │
│          │ ```                    │ │
│          └────────────────────────┘ │
│  [AI]: Great job! You got it...     │
│                                     │
├─────────────────────────────────────┤
│  [Chat input box]            [Send] │
└─────────────────────────────────────┘
````

---

## Exercise States

Exercises have distinct states that affect their display and interaction:

| State                  | Description                    | Visual Indicator                   | Interactions                   |
| ---------------------- | ------------------------------ | ---------------------------------- | ------------------------------ |
| `active`               | Currently being worked on      | Sticky panel visible               | Edit code, submit, skip, reset |
| `pending_review`       | Submitted, awaiting AI         | Submission in chat, loading        | None (wait for AI)             |
| `passed`               | AI approved (clean pass)       | Green badge ✓                      | View code, copy                |
| `passed_with_feedback` | Correct but improvements noted | Yellow badge ✓                     | View code, copy                |
| `needs_retry`          | AI requests another attempt    | Returns to sticky panel with hints | Edit code, submit, skip        |
| `failed`               | Exceeded retry attempts        | Red badge ✗                        | View code, retry button        |
| `skipped`              | User skipped                   | Gray badge ⊘                       | View code, retry button        |

### State Transitions

```
                    ┌──────────────┐
                    │   active     │
                    └──────┬───────┘
                           │ submit
                           ▼
                    ┌──────────────┐
                    │pending_review│
                    └──────┬───────┘
                           │ AI assesses
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  passed  │    │ feedback │    │needs_retry│
    └──────────┘    └──────────┘    └─────┬────┘
                                          │ retry
                                          ▼
                                   ┌──────────────┐
                                   │   active     │ (with hints)
                                   └──────────────┘
```

User can skip from `active` → `skipped` at any time.
User can retry from `skipped` or `failed` → `active` (re-opens original with optional new hints).

---

## Data Model

### Exercise Type (Updated)

```typescript
interface Exercise {
  id: string;
  title: string;
  language: string;
  instructions: string;
  starterCode: string; // Skeleton with ___ blanks
  expectedBehavior: string; // For AI assessment context
  status: ExerciseStatus;
  attempts: ExerciseAttempt[];
  hints: string[]; // Added after retries
  createdAt: string;
  updatedAt: string;
}

type ExerciseStatus =
  | "active"
  | "pending_review"
  | "passed"
  | "passed_with_feedback"
  | "needs_retry"
  | "failed"
  | "skipped";

interface ExerciseAttempt {
  id: string;
  code: string;
  submittedAt: string;
  feedback?: string; // AI feedback for this attempt
  result?: "correct" | "partial" | "incorrect";
}
```

### Message Type (Updated)

```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  contentBlocks?: ContentBlock[];
  exerciseSubmission?: ExerciseSubmission; // NEW: for user messages that are submissions
}

interface ExerciseSubmission {
  exerciseId: string;
  attemptId: string;
  code: string;
  title: string;
  instructions: string; // Brief, for display
}
```

### Session Type (Updated)

```typescript
interface Session {
  id: string;
  projectId: string;
  title: string;
  messages: Message[];
  exercises: Record<string, Exercise>; // NEW: keyed by exercise ID
  activeExerciseId: string | null; // NEW: currently active exercise
  createdAt: string;
  updatedAt: string;
}
```

---

## AI Tools

### 1. `create_exercise` (Updated)

Creates a new exercise and makes it active.

**Input Schema:**

```typescript
{
  title: string; // Concise title (e.g., "Calculate Factorial")
  language: string; // Programming language
  instructions: string; // Brief instructions (keep minimal for UI)
  starterCode: string; // Skeleton with ___ for blanks
  expectedBehavior: string; // What correct code should do (for assessment)
}
```

**Behavior:**

1. Validate that `starterCode` contains at least one `___` blank marker
2. Validate that `starterCode` is syntactically valid (basic check)
3. Create exercise with `status: 'active'`
4. Set `activeExerciseId` on session
5. Return exercise ID for reference

**Output:**

```typescript
{
  exerciseId: string;
  message: string; // "Exercise created successfully"
}
```

### 2. `update_exercise` (New)

Updates an existing exercise's status, hints, or feedback.

**Input Schema:**

```typescript
{
  exerciseId: string;
  status?: ExerciseStatus;
  hints?: string[];           // Add hints (appended to existing)
  attemptFeedback?: {         // Feedback for most recent attempt
    result: 'correct' | 'partial' | 'incorrect';
    feedback: string;
  };
}
```

**Behavior:**

1. Update exercise fields
2. If status changes from `needs_retry` to `active`, re-open in sticky panel
3. If status is terminal (`passed`, `passed_with_feedback`, `failed`, `skipped`), clear `activeExerciseId`

**Output:**

```typescript
{
  exerciseId: string;
  message: string;
}
```

---

## UI Components

### High-Level Architecture

```
src/components/
├── Chat/
│   ├── Chat.tsx                    # Main container (updated)
│   ├── MessageList.tsx             # Message rendering
│   ├── Message.tsx                 # Individual message
│   ├── ExerciseSubmissionCard.tsx  # NEW: Submitted exercise in chat
│   └── MessageInput.tsx            # Chat input (updated)
├── Exercise/
│   ├── ExercisePanel.tsx           # NEW: Sticky exercise panel
│   ├── ExerciseHeader.tsx          # NEW: Collapsible header
│   ├── ExerciseInstructions.tsx    # NEW: Instructions display
│   ├── ExerciseEditor.tsx          # NEW: Monaco wrapper for exercises
│   └── ExerciseActions.tsx         # NEW: Submit/Skip/Reset buttons
└── Editor/
    └── CodeEditor.tsx              # Existing Monaco wrapper (reused)
```

### Component Details

#### `ExercisePanel`

- Renders above `MessageInput` when `activeExerciseId` is set
- Manages collapsed/expanded state locally
- Contains: header, instructions, editor, actions
- Animates height changes smoothly

#### `ExerciseSubmissionCard`

- Rendered inside `Message` component for user messages with `exerciseSubmission`
- Shows: title, brief instructions, code (full if short, collapsed if long)
- Status badge based on linked exercise's current status
- "Retry" button for `skipped` or `failed` exercises

#### `MessageInput` (Updated)

- Chat input always visible
- Submit button for chat is separate from exercise submit
- Disabled state while AI is responding (queue submissions)

---

## Interaction Details

### Submitting an Exercise

1. User clicks "Submit" in exercise panel
2. Exercise panel disappears
3. New user message added to chat with `exerciseSubmission` data
4. Exercise status → `pending_review`
5. AI receives the submission as part of conversation
6. AI calls `update_exercise` to set status and provide feedback
7. AI responds with conversational feedback

### Asking Questions During Exercise

1. Exercise panel is active (can be collapsed or expanded)
2. User types in chat input and clicks Send
3. Chat message sent normally
4. AI responds (appears in chat above exercise panel)
5. Exercise panel remains active/unchanged

### Retry Flow

1. User clicks "Retry" on a `skipped` or `failed` exercise card in history
2. System calls AI with context: "User wants to retry exercise {id}"
3. AI calls `update_exercise` with status → `active` and optionally adds hints
4. Exercise re-appears in sticky panel with preserved last attempt code
5. User can click "Reset" to restore original skeleton

### Skip Flow

1. User clicks "Skip" in exercise panel
2. Confirmation dialog: "Skip this exercise? You can retry later."
3. On confirm: exercise status → `skipped`, clear `activeExerciseId`
4. Exercise card appears in chat history with skip status
5. AI is informed and continues conversation

### Reset Flow

1. User clicks "Reset" in exercise panel
2. Confirmation dialog: "Reset to starter code? Your changes will be lost."
3. On confirm: editor content restored to `starterCode`
4. Attempts history preserved

---

## AI Prompt Modifications

### Exercise Creation Guidelines

Add to system prompt:

````
When creating exercises:
- Keep exercises SHORT and ATOMIC - focus on one concept at a time
- Starter code should be 5-15 lines maximum
- Use 1-3 blank markers (___) for fill-in-the-blank style
- Instructions should fit in 2-3 sentences
- Title should be concise (3-5 words)
- If a concept requires more code, break into multiple sequential exercises

Example of good atomic exercise:
- Title: "Array Sum with Reduce"
- Instructions: "Fill in the blanks to sum all numbers using reduce."
- Starter code:
  ```javascript
  const numbers = [1, 2, 3, 4, 5];
  const sum = numbers.reduce((acc, num) => ___, ___);
  console.log(sum); // Should print 15
````

Avoid creating exercises that:

- Require more than 20 lines of code
- Have more than 5 blanks to fill
- Cover multiple unrelated concepts
- Need extensive context to understand

```

### Assessment Guidelines

Add to system prompt:

```

When assessing exercise submissions:

- For correct solutions: call update_exercise with status 'passed'
- For mostly correct with minor issues: use 'passed_with_feedback' and explain improvements
- For incorrect but showing understanding: use 'needs_retry', add hints, encourage retry
- After 2-3 failed attempts or if user seems frustrated: consider marking as 'failed' and moving on
- Always provide encouraging, specific feedback

Use your judgment on retry attempts - watch for:

- User explicitly asking to move on
- Repeated similar mistakes suggesting confusion
- Signs of frustration in chat messages

```

---

## Session Restoration

When a session loads with `activeExerciseId`:

1. Find exercise by ID in `session.exercises`
2. If exercise status is `active` or `needs_retry`:
   - Render exercise panel in sticky section
   - If attempts exist, load most recent attempt code
   - If no attempts, load `starterCode`
3. If exercise status is terminal, clear `activeExerciseId` and save

---

## Validation Requirements

### Exercise Creation Validation

Before displaying a created exercise:

1. **Blank markers exist**: `starterCode.includes('___')` must be true
2. **Basic syntax check**: Attempt to parse `starterCode` for the specified language (best effort)
3. **Length check**: Warn if starter code exceeds 30 lines (soft limit)

If validation fails, return error to AI asking it to regenerate.

---

## Core Implementation (Priority)

These features are required for MVP:

1. Exercise panel component with expand/collapse
2. Monaco editor integration in exercise panel
3. Submit/Skip/Reset functionality
4. Exercise submission cards in chat
5. `create_exercise` tool update
6. `update_exercise` tool (new)
7. Session storage for exercises
8. Active exercise restoration on session load
9. Updated AI prompts for atomic exercises

## Optional Enhancements (Future)

These can be added later:

1. Tab-to-jump between blank markers in Monaco
2. Syntax validation with inline error highlighting
3. Exercise difficulty indicators
4. Time tracking per exercise
5. Progress analytics across exercises
6. Keyboard shortcuts (Cmd+Enter to submit)
7. Mobile-responsive exercise panel
8. Accessibility improvements (ARIA labels, screen reader support)
9. Exercise templates/variations for common patterns
10. Secondary sidebar showing session exercise history

---

## Files to Modify

Based on current codebase structure:

| File | Changes |
|------|---------|
| `src/lib/types/index.ts` | Add/update Exercise, ExerciseSubmission types |
| `src/lib/storage/sessions.ts` | Update to handle exercises in session |
| `src/lib/agent/tutorServer.ts` | Update create_exercise, add update_exercise |
| `src/hooks/useChat.ts` | Exercise state management, submission handling |
| `src/components/Chat/Chat.tsx` | Layout changes, exercise panel integration |
| `src/components/Chat/Message.tsx` | Render ExerciseSubmissionCard |
| `src/app/projects/[projectId]/sessions/[sessionId]/page.tsx` | Remove editor pane |

| File | New |
|------|-----|
| `src/components/Exercise/ExercisePanel.tsx` | Sticky panel container |
| `src/components/Exercise/ExerciseHeader.tsx` | Collapsible header |
| `src/components/Exercise/ExerciseEditor.tsx` | Monaco wrapper |
| `src/components/Exercise/ExerciseActions.tsx` | Buttons |
| `src/components/Chat/ExerciseSubmissionCard.tsx` | Submission in chat |

---

## Open Questions

1. **Blank marker format**: Is `___` sufficient, or should we support named blanks like `___BLANK1___` for cases where the same value appears multiple times?

2. **Code length threshold**: At what line count should the submission card auto-collapse the code view? Suggest 10-15 lines.

3. **Session summary**: Should session summaries (via `wrap_up_session` tool) include exercise performance stats?
```
