import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureChatSchemaAndSeed } from "@/lib/chat-db";

export async function POST(req: NextRequest) {
  try {
    await ensureChatSchemaAndSeed();

    const body = await req.json();
    const {
      userId,
      status = "online",
      isTyping,
      typingRoom = "global",
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const now = new Date();
    const updatePayload: Partial<typeof chatUsers.$inferInsert> = {
      status: status === "away" ? "away" : status === "offline" ? "offline" : "online",
      lastSeenAt: now,
    };

    if (typeof isTyping === "boolean") {
      updatePayload.isTyping = isTyping;
      updatePayload.typingRoom = typingRoom;
      updatePayload.typingUpdatedAt = now;
    }

    await db
      .update(chatUsers)
      .set(updatePayload)
      .where(eq(chatUsers.id, userId));

    return NextResponse.json({ ok: true, serverTime: now.toISOString() });
  } catch (error) {
    console.error("Error in POST /api/presence/heartbeat:", error);
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
