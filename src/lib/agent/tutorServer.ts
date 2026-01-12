import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import * as storage from "../storage";
import {
  addExerciseToSession,
  setActiveExerciseId,
  updateExerciseInSession,
} from "../storage/sessions";
import { generateId } from "../storage/utils";
import type { Exercise } from "../types";

export const tutorServer = createSdkMcpServer({
  name: "coding-tutor",
  version: "1.0.0",
  tools: [
    // 1. read_progress - Read student progress for a topic
    tool(
      "read_progress",
      "Read the student's progress file for a specific topic within the current project. Use this at the start of a session to understand what the student already knows.",
      {
        topic: z
          .string()
          .describe(
            "The topic identifier (e.g., 'swift-optionals', 'python-functions', 'react-hooks')"
          ),
        projectId: z.string().describe("The project identifier"),
      },
      async (args) => {
        try {
          const progress = await storage.getProgress(args.projectId, args.topic);
          return {
            content: [
              {
                type: "text" as const,
                text: progress
                  ? JSON.stringify(progress, null, 2)
                  : `No progress found for topic "${args.topic}". This appears to be a new topic for this student.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error reading progress: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 2. update_progress - Update student progress after learning
    tool(
      "update_progress",
      "Update the student's progress file after learning or completing exercises. Call this when the student demonstrates mastery or struggles with concepts.",
      {
        projectId: z.string().describe("The project identifier"),
        topic: z.string().describe("The topic identifier"),
        updates: z.object({
          overallLevel: z
            .enum(["beginner", "intermediate", "advanced"])
            .optional()
            .describe("Update the overall level for this topic"),
          addToMastered: z
            .array(z.string())
            .optional()
            .describe("Concepts the student has mastered"),
          addToReinforcement: z
            .array(z.string())
            .optional()
            .describe("Concepts needing more practice"),
          removeFromReinforcement: z
            .array(z.string())
            .optional()
            .describe("Concepts to remove from reinforcement (now mastered)"),
          sessionNote: z
            .object({
              covered: z.array(z.string()).describe("Topics covered in this session"),
              performance: z.string().describe("Brief performance summary"),
              notes: z.string().optional().describe("Additional notes about the student"),
            })
            .optional()
            .describe("Notes about this session"),
        }),
      },
      async (args) => {
        try {
          await storage.updateProgress(args.projectId, args.topic, args.updates);
          return {
            content: [
              {
                type: "text" as const,
                text: `Progress updated successfully for topic "${args.topic}".`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error updating progress: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 3. create_exercise - Create a coding exercise
    tool(
      "create_exercise",
      "Create a coding exercise for the student. This will populate the code editor with starter code and display the exercise instructions.",
      {
        projectId: z.string().describe("The project identifier"),
        sessionId: z.string().describe("The session identifier"),
        title: z.string().describe("The exercise title (e.g., 'Unwrapping Optionals')"),
        language: z
          .string()
          .describe(
            "Programming language for syntax highlighting (e.g., 'swift', 'python', 'typescript', 'javascript')"
          ),
        instructions: z
          .string()
          .describe("Clear instructions for what the student should implement"),
        starterCode: z.string().describe("Initial code to populate the editor"),
        expectedBehavior: z
          .string()
          .describe(
            "Description of what the correct solution should do (e.g., 'safeLength(\"hello\") returns 5')"
          ),
      },
      async (args) => {
        // Validate starterCode contains at least one blank marker
        if (!args.starterCode.includes("___")) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Starter code must contain at least one blank marker (___)",
                }),
              },
            ],
          };
        }

        // Generate unique exercise ID
        const exerciseId = generateId();

        // Create exercise object
        const exercise: Exercise = {
          id: exerciseId,
          title: args.title,
          language: args.language,
          instructions: args.instructions,
          starterCode: args.starterCode,
          expectedBehavior: args.expectedBehavior,
          status: "active",
          attempts: [],
          hints: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Persist exercise to session
        await addExerciseToSession(args.projectId, args.sessionId, exercise);

        // Set as active exercise
        await setActiveExerciseId(args.projectId, args.sessionId, exerciseId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                exerciseId,
                message: "Exercise created successfully",
              }),
            },
          ],
        };
      }
    ),

    // 4. update_exercise - Update exercise status after assessment
    tool(
      "update_exercise",
      "Update exercise status after assessing a student's submission. Use this after reviewing submitted code to mark the exercise as passed or provide feedback.",
      {
        projectId: z.string().describe("The project ID"),
        sessionId: z.string().describe("The session ID"),
        exerciseId: z.string().describe("The exercise ID to update"),
        status: z.enum(["passed", "skipped"]).optional().describe("New status for the exercise"),
        attemptFeedback: z
          .object({
            result: z.enum(["correct", "partial", "incorrect"]),
            feedback: z.string(),
          })
          .optional()
          .describe("Feedback for the most recent attempt"),
      },
      async ({ projectId, sessionId, exerciseId, status, attemptFeedback: _attemptFeedback }) => {
        const updates: Partial<Exercise> = {
          updatedAt: new Date().toISOString(),
        };

        if (status) {
          updates.status = status;
        }

        // Note: _attemptFeedback would update the most recent attempt
        // For MVP, we just store the status update

        await updateExerciseInSession(projectId, sessionId, exerciseId, updates);

        // Clear activeExerciseId if terminal status
        if (status === "passed" || status === "skipped") {
          await setActiveExerciseId(projectId, sessionId, null);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ exerciseId, message: "Exercise updated successfully" }),
            },
          ],
        };
      }
    ),

    // 5. list_topics - List all topics with progress
    tool(
      "list_topics",
      "Get all topics with progress data for the current project. Use this to see what the student has studied before.",
      {
        projectId: z.string().describe("The project identifier"),
      },
      async (args) => {
        try {
          const topics = await storage.listTopicsWithProgress(args.projectId);
          return {
            content: [
              {
                type: "text" as const,
                text:
                  topics.length > 0
                    ? JSON.stringify(topics, null, 2)
                    : "No topics with progress found for this project. This student is new.",
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing topics: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 6. wrap_up_session - End session and save summary
    tool(
      "wrap_up_session",
      "End the current tutoring session, save the summary, and mark all relevant progress updates. Call this when the student wants to finish the session.",
      {
        projectId: z.string().describe("The project identifier"),
        sessionId: z.string().describe("The session identifier"),
        summary: z
          .string()
          .describe("A comprehensive summary of what was covered and learned in this session"),
        topicsUpdated: z
          .array(z.string())
          .describe("List of topics that were covered in this session"),
      },
      async (args) => {
        try {
          await storage.wrapUpSession(
            args.projectId,
            args.sessionId,
            args.summary,
            args.topicsUpdated
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Session wrapped up successfully. Summary saved and progress recorded for topics: ${args.topicsUpdated.join(", ")}.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error wrapping up session: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),
  ],
});
