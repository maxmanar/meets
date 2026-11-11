import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureChatSchemaAndSeed, getChatSnapshot } from "@/lib/chat-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureChatSchemaAndSeed();

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId") || "global";
    const userId = searchParams.get("userId");
    const visibility = searchParams.get("visibility") || "visible";

    // If an active user is syncing and hasn't explicitly gone offline, refresh their heartbeat
    if (userId) {
      const existing = await db
        .select()
        .from(chatUsers)
        .where(eq(chatUsers.id, userId))
        .limit(1);

      if (existing.length > 0 && existing[0].status !== "offline") {
        const nextStatus = visibility === "hidden" ? "away" : "online";
        await db
          .update(chatUsers)
          .set({
            status: nextStatus,
            lastSeenAt: new Date(),
          })
          .where(eq(chatUsers.id, userId));
      }
    }

    const snapshot = await getChatSnapshot(roomId);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/sync:", error);
    return NextResponse.json(
      { error: "Failed to synchronize chat state" },
      { status: 500 }
    );
  }
}
