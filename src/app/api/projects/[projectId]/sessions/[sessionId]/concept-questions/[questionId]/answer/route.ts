import { NextResponse } from "next/server";
import { answerConceptQuestion } from "@/lib/storage/sessions";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    projectId: string;
    sessionId: string;
    questionId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId, questionId } = await params;
    const { selectedOptionIndex } = await request.json();

    if (typeof selectedOptionIndex !== "number") {
      return NextResponse.json(
        { error: "selectedOptionIndex is required and must be a number" },
        { status: 400 }
      );
    }

    const question = await answerConceptQuestion(
      projectId,
      sessionId,
      questionId,
      selectedOptionIndex
    );

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error("Error answering concept question:", error);
    return NextResponse.json({ error: "Failed to answer concept question" }, { status: 500 });
  }
}
