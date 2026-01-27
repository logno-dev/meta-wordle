import { NextResponse } from "next/server";
import { isValidWord } from "@/lib/dictionary";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const word = searchParams.get("word")?.trim().toLowerCase() ?? "";
    if (!word) {
      return NextResponse.json({ error: "word is required." }, { status: 400 });
    }

    const valid = await isValidWord(word);
    return NextResponse.json({ valid });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to validate word.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to validate word." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
