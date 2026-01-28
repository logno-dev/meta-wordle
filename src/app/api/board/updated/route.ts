import { NextResponse } from "next/server";
import { getBoardUpdated } from "@/lib/board-meta";

export async function GET() {
  try {
    const updatedAt = await getBoardUpdated(1);
    return NextResponse.json({ updated_at: updatedAt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load board status.";
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to load board status."
        : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
