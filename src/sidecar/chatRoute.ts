import type { Request, Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { tutorServer } from "./tutorServer";
import { getTutorSystemPrompt } from "../lib/agent/systemPrompt";

interface ChatRequest {
  message: string;
  projectId: string;
  sessionId: string;
  resumeSessionId?: string;
  action: "message" | "submit" | "hint" | "skip" | "concept_answer";
  editorCode?: string;
  testingMode?: boolean;
}

export async function handleChat(req: Request, res: Response): Promise<void> {
  const body: ChatRequest = req.body;
  const { message, projectId, sessionId, resumeSessionId, action, editorCode, testingMode } = body;

  // Build the prompt based on action type
  let promptText: string;
  const debugPrefix = testingMode ? `[DEBUG — Testing Mode]\nAction: ${action}\n` : "";

  if (action === "submit") {
    promptText = `${debugPrefix}${testingMode ? `Submission received:\n\`\`\`\n${editorCode}\n\`\`\`\n\n` : ""}The student has submitted their answer for evaluation:

${editorCode}

Please evaluate this solution. Check if it meets the expected behavior, point out what was done correctly, explain any errors or areas for improvement, and decide the next step (another exercise, harder variant, or move on).`;
  } else if (action === "hint") {
    promptText = `${debugPrefix}${testingMode ? `Editor code received:\n\`\`\`\n${editorCode}\n\`\`\`\n\n` : ""}The student is asking for a hint. Their current code is:

\`\`\`
${editorCode}
\`\`\`

Provide a helpful hint that guides them toward the solution without giving away the answer. Focus on the concept they might be missing or a small nudge in the right direction.`;
  } else {
    promptText = debugPrefix + message;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let stopBeforeNextAssistant = false;

    for await (const sdkMessage of query({
      prompt: promptText,
      options: {
        mcpServers: {
          "coding-tutor": tutorServer,
        },
        allowedTools: [
          "mcp__coding-tutor__read_progress",
          "mcp__coding-tutor__update_progress",
          "mcp__coding-tutor__create_exercise",
          "mcp__coding-tutor__update_exercise",
          "mcp__coding-tutor__list_topics",
          "mcp__coding-tutor__ask_concept_question",
          "mcp__coding-tutor__wrap_up_session",
          "WebSearch",
          "WebFetch",
        ],
        systemPrompt: getTutorSystemPrompt(projectId, sessionId, testingMode ?? false),
        resume: resumeSessionId,
        permissionMode: "bypassPermissions",
        maxTurns: 10,
        // In compiled binary mode, the SDK can't auto-detect the claude CLI path.
        // Use CLAUDE_PATH env var if set, otherwise let the SDK find it.
        ...(process.env.CLAUDE_PATH ? { pathToClaudeCodeExecutable: process.env.CLAUDE_PATH } : {}),
      },
    })) {
      const msg = sdkMessage as Record<string, unknown>;

      if (stopBeforeNextAssistant && msg.type === "assistant") {
        break;
      }

      const data = JSON.stringify({
        ...sdkMessage,
        _meta: { projectId, sessionId },
      });
      res.write(`data: ${data}\n\n`);

      // Detect tool calls that should stop the loop
      if (msg.type === "assistant") {
        const message = msg.message as
          | {
              content?: Array<{
                type: string;
                name?: string;
                input?: Record<string, unknown>;
              }>;
            }
          | undefined;
        if (message?.content) {
          for (const block of message.content) {
            if (block.type !== "tool_use") continue;

            if (
              block.name === "mcp__coding-tutor__ask_concept_question" ||
              block.name === "mcp__coding-tutor__create_exercise"
            ) {
              stopBeforeNextAssistant = true;
            }

            if (block.name === "mcp__coding-tutor__update_exercise") {
              const status = block.input?.status as string | undefined;
              if (status && status !== "passed" && status !== "passed_with_feedback") {
                stopBeforeNextAssistant = true;
              }
            }
          }
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Chat API error:", error);
    const errorData = JSON.stringify({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
}
