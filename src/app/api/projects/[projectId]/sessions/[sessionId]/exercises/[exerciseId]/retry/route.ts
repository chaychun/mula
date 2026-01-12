import { NextResponse } from "next/server";
import * as storage from "@/lib/storage";

// Force dynamic to prevent any caching
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ projectId: string; sessionId: string; exerciseId: string }>;
}

// POST /api/projects/[projectId]/sessions/[sessionId]/exercises/[exerciseId]/retry
// Retry an exercise - reactivates a skipped or failed exercise
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId, exerciseId } = await params;

    // Update exercise status to active
    const exerciseFound = await storage.updateExerciseInSession(projectId, sessionId, exerciseId, {
      status: "active",
    });

    if (!exerciseFound) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    // Set this as the active exercise
    await storage.setActiveExerciseId(projectId, sessionId, exerciseId);

    return NextResponse.json({ success: true, exerciseId, status: "active" });
  } catch (error) {
    console.error("Error retrying exercise:", error);
    return NextResponse.json({ error: "Failed to retry exercise" }, { status: 500 });
  }
}
