import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, chatUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureChatSchemaAndSeed, getChatSnapshot } from "@/lib/chat-db";

export async function POST(req: NextRequest) {
  try {
    await ensureChatSchemaAndSeed();

    const body = await req.json();
    const {
      id,
      name,
      avatar = "🦅",
      color = "from-indigo-500 to-cyan-400",
      bio = "متصل الآن في صالون تواصل المباشر",
      roleBadge = "عضو نشط",
      roomId = "global",
    } = body;

    if (!id || !name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "الرجاء إدخال الاسم المستعار للمتابعة" },
        { status: 400 }
      );
    }

    const cleanName = name.trim().slice(0, 40);
    const cleanBio = (bio || "متصل الآن في صالون تواصل المباشر").trim().slice(0, 100);
    const now = new Date();

    const existing = await db
      .select()
      .from(chatUsers)
      .where(eq(chatUsers.id, id))
      .limit(1);

    let isNewJoin = false;

    if (existing.length === 0) {
      isNewJoin = true;
      await db.insert(chatUsers).values({
        id,
        name: cleanName,
        avatar,
        color,
        bio: cleanBio,
        roleBadge,
        status: "online",
        isTyping: false,
        typingRoom: roomId,
        lastSeenAt: now,
        joinedAt: now,
        isSimulated: false,
      });
    } else {
      const wasOffline = existing[0].status === "offline";
      if (wasOffline) isNewJoin = true;

      await db
        .update(chatUsers)
        .set({
          name: cleanName,
          avatar,
          color,
          bio: cleanBio,
          roleBadge,
          status: "online",
          lastSeenAt: now,
        })
        .where(eq(chatUsers.id, id));
    }

    if (isNewJoin) {
      await db.insert(chatMessages).values({
        roomId: "global",
        senderId: id,
        senderName: cleanName,
        senderAvatar: avatar,
        senderColor: color,
        senderBadge: roleBadge,
        messageType: "system",
        content: `انضم ${cleanName} إلى الدردشة المباشرة وهو متصل الآن 🟢`,
        reactions: "{}",
      });
    }

    const [user] = await db
      .select()
      .from(chatUsers)
      .where(eq(chatUsers.id, id))
      .limit(1);

    const snapshot = await getChatSnapshot(roomId);

    return NextResponse.json({
      user,
      ...snapshot,
    });
  } catch (error) {
    console.error("Error in POST /api/profile:", error);
    return NextResponse.json(
      { error: "تعذر حفظ الملف الشخصي" },
      { status: 500 }
    );
  }
}
