import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, chatUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureChatSchemaAndSeed } from "@/lib/chat-db";

export async function POST(req: NextRequest) {
  try {
    await ensureChatSchemaAndSeed();

    const rawText = await req.text();
    let payload: { userId?: string; announce?: boolean; roomId?: string } = {};
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = {};
    }

    const { userId, announce = true, roomId = "global" } = payload;
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(chatUsers)
      .where(eq(chatUsers.id, userId))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      const wasOnlineOrAway = user.status !== "offline";

      await db
        .update(chatUsers)
        .set({
          status: "offline",
          isTyping: false,
          lastSeenAt: new Date(),
        })
        .where(eq(chatUsers.id, userId));

      if (announce && wasOnlineOrAway) {
        await db.insert(chatMessages).values({
          roomId,
          senderId: user.id,
          senderName: user.name,
          senderAvatar: user.avatar,
          senderColor: user.color,
          senderBadge: user.roleBadge,
          messageType: "system",
          content: `غادر ${user.name} الموقع وأصبحت حالته غير متصل (Offline) 🔴`,
          reactions: "{}",
        });
      }
    }

    return NextResponse.json({ ok: true, status: "offline" });
  } catch (error) {
    console.error("Error in POST /api/presence/leave:", error);
    return NextResponse.json({ error: "Leave failed" }, { status: 500 });
  }
}
