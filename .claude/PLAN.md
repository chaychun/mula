# Chat-First Exercise UI Implementation Plan

## Overview

This plan transforms the current dual-pane layout (chat + code editor) into a unified chat-first experience where exercises appear as a sticky panel above the chat input.

**Key Decisions Made:**

- Remove editor pane completely (clean break, no feature flag)
- Create simplified ExerciseEditor wrapper for the exercise panel
- Core states only for MVP: `active`, `pending_review`, `passed`, `skipped`
- Migrate existing sessions (add empty `exercises` field on load)

---

## Phase 1: Data Model Updates

**Commit: "Update types and storage for exercise-first model"**

### 1.1 Update Types (`src/lib/types/index.ts`)

Add/update the following types:

```typescript
// New Exercise status type (MVP subset)
type ExerciseStatus = "active" | "pending_review" | "passed" | "skipped";

// Updated Exercise interface
interface Exercise {
  id: string;
  title: string;
  language: string;
  instructions: string;
  starterCode: string;
  expectedBehavior: string;
  status: ExerciseStatus;
  attempts: ExerciseAttempt[];
  hints: string[];
  createdAt: string;
  updatedAt: string;
}

interface ExerciseAttempt {
  id: string;
  code: string;
  submittedAt: string;
  feedback?: string;
  result?: "correct" | "partial" | "incorrect";
}

// New: Exercise submission in messages
interface ExerciseSubmission {
  exerciseId: string;
  attemptId: string;
  code: string;
  title: string;
  instructions: string;
}

// Update Message interface
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  contentBlocks?: ContentBlock[];
  exerciseSubmission?: ExerciseSubmission; // NEW
}

// Update Session interface
interface Session {
  id: string;
  projectId: string;
  agentSessionId?: string;
  title: string;
  messages: Message[];
  exercises: Record<string, Exercise>; // NEW: keyed by exercise ID
  activeExerciseId: string | null; // NEW
  createdAt: string;
  updatedAt: string;
  topics: string[];
  status: "active" | "completed";
  wrapUpSummary?: string;
}
```

### 1.2 Update Session Storage (`src/lib/storage/sessions.ts`)

- Add migration logic: when loading a session, add `exercises: {}` and `activeExerciseId: null` if missing
- Add helper functions:
  - `addExerciseToSession(projectId, sessionId, exercise)`
  - `updateExerciseStatus(projectId, sessionId, exerciseId, updates)`
  - `setActiveExercise(projectId, sessionId, exerciseId | null)`
  - `addExerciseAttempt(projectId, sessionId, exerciseId, attempt)`

### 1.3 Remove Legacy Types

- Remove `ExerciseRecord` interface (replaced by new `Exercise`)
- Keep `exercise?: Exercise` on Message for backward compatibility during transition

**Files Modified:**

- `src/lib/types/index.ts`
- `src/lib/storage/sessions.ts`

---

## Phase 2: Update AI Tools

**Commit: "Update create_exercise and add update_exercise tool"**

### 2.1 Update `create_exercise` Tool (`src/lib/agent/tutorServer.ts`)

Current tool returns exercise JSON in text. Update to:

1. Generate unique exercise ID
2. Create exercise with `status: 'active'`
3. Store in session's `exercises` record
4. Set `activeExerciseId` on session
5. Return structured response

```typescript
tool("create_exercise", {
  description: "Create a coding exercise...",
  parameters: z.object({
    projectId: z.string(),
    sessionId: z.string(),
    title: z.string(),
    language: z.string(),
    instructions: z.string(),
    starterCode: z.string(),
    expectedBehavior: z.string(),
  }),
  execute: async ({
    projectId,
    sessionId,
    title,
    language,
    instructions,
    starterCode,
    expectedBehavior,
  }) => {
    // Validate starterCode contains ___
    if (!starterCode.includes("___")) {
      return { error: "Starter code must contain at least one blank marker (___)" };
    }

    const exerciseId = generateId();
    const exercise: Exercise = {
      id: exerciseId,
      title,
      language,
      instructions,
      starterCode,
      expectedBehavior,
      status: "active",
      attempts: [],
      hints: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addExerciseToSession(projectId, sessionId, exercise);
    await setActiveExercise(projectId, sessionId, exerciseId);

    return { exerciseId, message: "Exercise created successfully" };
  },
});
```

### 2.2 Add `update_exercise` Tool

New tool for AI to update exercise status after assessment:

```typescript
tool("update_exercise", {
  description: "Update exercise status after assessing submission",
  parameters: z.object({
    projectId: z.string(),
    sessionId: z.string(),
    exerciseId: z.string(),
    status: z.enum(["passed", "skipped"]).optional(), // MVP subset
    attemptFeedback: z
      .object({
        result: z.enum(["correct", "partial", "incorrect"]),
        feedback: z.string(),
      })
      .optional(),
  }),
  execute: async ({ projectId, sessionId, exerciseId, status, attemptFeedback }) => {
    const updates: Partial<Exercise> = {
      updatedAt: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
    }

    if (attemptFeedback) {
      // Update most recent attempt with feedback
      // (handled in storage layer)
    }

    await updateExerciseStatus(projectId, sessionId, exerciseId, updates);

    // Clear activeExerciseId if terminal status
    if (status === "passed" || status === "skipped") {
      await setActiveExercise(projectId, sessionId, null);
    }

    return { exerciseId, message: "Exercise updated" };
  },
});
```

### 2.3 Update Allowed Tools in API Route

Add `update_exercise` to allowed tools list in `src/app/api/chat/route.ts`.

### 2.4 Update System Prompt

Add exercise creation and assessment guidelines from spec to `src/lib/agent/systemPrompt.ts`.

**Files Modified:**

- `src/lib/agent/tutorServer.ts`
- `src/app/api/chat/route.ts`
- `src/lib/agent/systemPrompt.ts`

---

## Phase 3: Exercise Panel Components

**Commit: "Add ExercisePanel component with editor and actions"**

### 3.1 Create Component Structure

```
src/components/Exercise/
├── ExercisePanel.tsx        # Main container (sticky above input)
├── ExerciseHeader.tsx       # Collapsible header with title
├── ExerciseInstructions.tsx # Instructions display
├── ExerciseEditor.tsx       # Monaco wrapper for exercises
└── ExerciseActions.tsx      # Submit/Skip/Reset buttons
```

### 3.2 ExercisePanel Component

```typescript
interface ExercisePanelProps {
  exercise: Exercise;
  onSubmit: (code: string) => void;
  onSkip: () => void;
  onReset: () => void;
  disabled?: boolean; // During streaming
}

// Features:
// - Collapsible (stores state locally)
// - Renders header, instructions, editor, actions
// - Smooth height animation on collapse/expand
```

### 3.3 ExerciseHeader Component

```typescript
interface ExerciseHeaderProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

// Features:
// - Chevron icon (▼/►) for collapse state
// - Exercise title
// - Click anywhere to toggle
```

### 3.4 ExerciseInstructions Component

```typescript
interface ExerciseInstructionsProps {
  instructions: string;
  hints?: string[];
}

// Features:
// - Display instructions text
// - Show hints if available (from retries - future feature)
```

### 3.5 ExerciseEditor Component

Simplified Monaco wrapper for exercises:

```typescript
interface ExerciseEditorProps {
  code: string;
  language: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

// Features:
// - Smaller default height (150-200px)
// - Basic Monaco config (no minimap, simpler)
// - Read-only when disabled
```

### 3.6 ExerciseActions Component

```typescript
interface ExerciseActionsProps {
  onSubmit: () => void;
  onSkip: () => void;
  onReset: () => void;
  disabled?: boolean;
  isPending?: boolean; // Show loading state
}

// Features:
// - Reset button (left side)
// - Skip button (middle)
// - Submit button (right, primary)
// - Confirmation dialogs for Skip and Reset
```

**Files Created:**

- `src/components/Exercise/ExercisePanel.tsx`
- `src/components/Exercise/ExerciseHeader.tsx`
- `src/components/Exercise/ExerciseInstructions.tsx`
- `src/components/Exercise/ExerciseEditor.tsx`
- `src/components/Exercise/ExerciseActions.tsx`

---

## Phase 4: Exercise Submission Card

**Commit: "Add ExerciseSubmissionCard for chat history"**

### 4.1 Create ExerciseSubmissionCard Component

```typescript
// src/components/Chat/ExerciseSubmissionCard.tsx

interface ExerciseSubmissionCardProps {
  submission: ExerciseSubmission;
  exercise?: Exercise; // Linked exercise for status
  onRetry?: () => void;
}

// Features:
// - Title with status badge (✓ passed, ⊘ skipped)
// - Brief instructions preview
// - Collapsed code view (expandable if long)
// - Syntax highlighted code
// - Retry button for skipped exercises
```

### 4.2 Update Message Component

Modify `src/components/Chat/Message.tsx` to render `ExerciseSubmissionCard` when `message.exerciseSubmission` exists.

**Files Created:**

- `src/components/Chat/ExerciseSubmissionCard.tsx`

**Files Modified:**

- `src/components/Chat/Message.tsx`

---

## Phase 5: Chat Hook Updates

**Commit: "Update useChat for exercise state management"**

### 5.1 Update useChat Hook (`src/hooks/useChat.ts`)

Add exercise state management:

```typescript
// New state
const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

// New callbacks
const handleExerciseSubmit = async (code: string) => {
  if (!activeExercise) return;

  const attemptId = generateId();
  const attempt: ExerciseAttempt = {
    id: attemptId,
    code,
    submittedAt: new Date().toISOString(),
  };

  // Add attempt to exercise
  await addExerciseAttempt(projectId, sessionId, activeExercise.id, attempt);

  // Update exercise status to pending_review
  await updateExerciseStatus(projectId, sessionId, activeExercise.id, {
    status: "pending_review",
  });

  // Create submission message
  const submissionMessage: Message = {
    id: generateId(),
    role: "user",
    content: "", // Content is in exerciseSubmission
    timestamp: new Date().toISOString(),
    exerciseSubmission: {
      exerciseId: activeExercise.id,
      attemptId,
      code,
      title: activeExercise.title,
      instructions: activeExercise.instructions,
    },
  };

  // Add to messages and send to AI
  // AI will assess and call update_exercise
  sendMessage(
    `[Exercise Submission]\nTitle: ${activeExercise.title}\n\nCode:\n\`\`\`${activeExercise.language}\n${code}\n\`\`\``,
    "submit"
  );

  // Clear active exercise (panel disappears)
  setActiveExercise(null);
};

const handleExerciseSkip = async () => {
  if (!activeExercise) return;

  await updateExerciseStatus(projectId, sessionId, activeExercise.id, {
    status: "skipped",
  });
  await setActiveExercise(projectId, sessionId, null);

  // Inform AI
  sendMessage(`[Skipped exercise: ${activeExercise.title}]`, "message");

  setActiveExercise(null);
};

const handleExerciseReset = () => {
  // Just reset the editor to starterCode
  // Handled in UI component, no backend call
};
```

### 5.2 Update Exercise Detection

When parsing streaming response, detect when AI creates exercise via tool call result:

```typescript
// In stream processing
if (toolCall.name === "mcp__mula__create_exercise" && toolCall.output) {
  const result = JSON.parse(toolCall.output);
  if (result.exerciseId) {
    // Fetch the created exercise from session
    const session = await getSession(projectId, sessionId);
    const exercise = session.exercises[result.exerciseId];
    if (exercise) {
      setActiveExercise(exercise);
    }
  }
}
```

### 5.3 Load Active Exercise on Session Load

When loading messages, also check for `activeExerciseId` and load that exercise.

**Files Modified:**

- `src/hooks/useChat.ts`

---

## Phase 6: Layout Restructure

**Commit: "Remove editor pane, integrate exercise panel into chat"**

### 6.1 Update Session Page (`src/app/projects/[projectId]/sessions/[sessionId]/page.tsx`)

Remove the dual-pane layout:

**Before:**

```tsx
<div className="flex flex-row">
  <div className="w-1/2">  {/* Editor pane */}
    <EditorToolbar ... />
    <CodeEditor ... />
  </div>
  <div className="w-1/2">  {/* Chat pane */}
    <Chat ... />
  </div>
</div>
```

**After:**

```tsx
<div className="flex flex-col h-full">
  <Chat
    activeExercise={activeExercise}
    onExerciseSubmit={handleExerciseSubmit}
    onExerciseSkip={handleExerciseSkip}
    onExerciseReset={handleExerciseReset}
    ...
  />
</div>
```

### 6.2 Update Chat Component (`src/components/Chat/Chat.tsx`)

Add exercise panel rendering above MessageInput:

```tsx
interface ChatProps {
  // ... existing props
  activeExercise?: Exercise | null;
  onExerciseSubmit?: (code: string) => void;
  onExerciseSkip?: () => void;
  onExerciseReset?: () => void;
}

// Layout:
<div className="flex flex-col h-full">
  <ScrollArea className="flex-1">
    <MessageList ... />
  </ScrollArea>

  {activeExercise && (
    <ExercisePanel
      exercise={activeExercise}
      onSubmit={onExerciseSubmit}
      onSkip={onExerciseSkip}
      onReset={onExerciseReset}
      disabled={isStreaming}
    />
  )}

  <MessageInput ... />
</div>
```

### 6.3 Remove Unused Editor Components

Mark for removal or keep for future use:

- `src/components/Editor/EditorToolbar.tsx` - Remove
- `src/components/Editor/CodeEditor.tsx` - Keep (used by ExerciseEditor)

### 6.4 Update Session Page State

Remove editor-specific state:

- Remove `editorCode`, `editorLanguage` state
- Remove `currentExercise` (replaced by `activeExercise` from useChat)
- Simplify action handling

**Files Modified:**

- `src/app/projects/[projectId]/sessions/[sessionId]/page.tsx`
- `src/components/Chat/Chat.tsx`

**Files Removed:**

- `src/components/Editor/EditorToolbar.tsx`

---

## Phase 7: Session Restoration & Polish

**Commit: "Add session restoration and finishing touches"**

### 7.1 Session Restoration Logic

When session loads with `activeExerciseId`:

```typescript
// In useChat or session page
useEffect(() => {
  if (currentSession?.activeExerciseId) {
    const exercise = currentSession.exercises[currentSession.activeExerciseId];
    if (exercise && (exercise.status === "active" || exercise.status === "pending_review")) {
      setActiveExercise(exercise);
      // If has attempts, load most recent attempt code
      if (exercise.attempts.length > 0) {
        const lastAttempt = exercise.attempts[exercise.attempts.length - 1];
        // Pre-fill editor with last attempt code
      }
    } else {
      // Clear stale activeExerciseId
      setActiveExercise(projectId, sessionId, null);
    }
  }
}, [currentSession]);
```

### 7.2 Styling & Animation

- Add smooth collapse/expand animation to ExercisePanel
- Match existing shadcn/ui styling
- Ensure proper dark mode support
- Mobile responsiveness for exercise panel

### 7.3 Confirmation Dialogs

Add confirmation dialogs using shadcn AlertDialog:

- Skip confirmation: "Skip this exercise? You can retry later."
- Reset confirmation: "Reset to starter code? Your changes will be lost."

### 7.4 Error Handling

- Handle failed tool calls gracefully
- Show error state in ExercisePanel if exercise creation fails
- Retry logic for failed API calls

**Files Modified:**

- `src/hooks/useChat.ts`
- `src/components/Exercise/ExerciseActions.tsx`
- Various component styling updates

---

## Implementation Order Summary

| Phase | Commit Message                                           | Key Deliverables         |
| ----- | -------------------------------------------------------- | ------------------------ |
| 1     | "Update types and storage for exercise-first model"      | Types, storage migration |
| 2     | "Update create_exercise and add update_exercise tool"    | AI tools, prompts        |
| 3     | "Add ExercisePanel component with editor and actions"    | Exercise UI components   |
| 4     | "Add ExerciseSubmissionCard for chat history"            | Submission display       |
| 5     | "Update useChat for exercise state management"           | Hook logic               |
| 6     | "Remove editor pane, integrate exercise panel into chat" | Layout change            |
| 7     | "Add session restoration and finishing touches"          | Polish                   |

---

## Agent Orchestration Strategy

Each phase will be implemented by a Sonnet subagent:

1. **Main orchestrator (this conversation)**: Coordinates phases, reviews commits
2. **Phase agents**: Each phase is a separate agent task that:
   - Receives the phase spec above
   - Implements the changes
   - Runs `bun run check` (format + lint)
   - Reports back for review

After each phase:

- Orchestrator reviews the changes
- Creates a commit with the specified message
- Proceeds to next phase

---

## Dependencies Between Phases

```
Phase 1 (Types) ─────┐
                     ├──→ Phase 2 (Tools) ──→ Phase 5 (Hook)
                     │                              │
                     └──→ Phase 3 (Components) ─────┤
                                                    │
Phase 4 (Card) ─────────────────────────────────────┤
                                                    │
                                                    ▼
                                          Phase 6 (Layout)
                                                    │
                                                    ▼
                                          Phase 7 (Polish)
```

Phases 1-4 can potentially run in parallel after Phase 1 completes.
Phase 5-6 depend on all previous phases.
Phase 7 is final polish.

---

## Testing Strategy

After each phase:

1. Run `bun run check` (format + lint)
2. Manual testing where applicable:
   - Phase 1-2: Run dev server, verify no runtime errors
   - Phase 3-4: Visual inspection of components
   - Phase 5-6: Full flow testing (create exercise → submit → pass)
   - Phase 7: Edge cases, session restoration

---

## Rollback Strategy

Since we're doing clean break (no feature flag):

- Each commit is atomic and self-contained
- If major issues found, can revert to previous commit
- Git branch allows easy rollback to main if needed

---

## Out of Scope (Future PRs)

- `needs_retry` and `failed` states
- `passed_with_feedback` state
- Tab-to-jump between blank markers
- Retry button from history
- Time tracking
- Progress analytics
- Keyboard shortcuts (Cmd+Enter)
