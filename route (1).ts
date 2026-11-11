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
      roomId = "global",
      senderId,
      senderName,
      senderAvatar = "🦅",
      senderColor = "from-indigo-500 to-cyan-400",
      senderBadge = "عضو نشط",
      messageType = "text",
      content = "",
      mediaUrl = null,
      mediaMeta = null,
      replyToId = null,
      replyToName = null,
      replyToPreview = null,
    } = body;

    if (!senderId || !senderName) {
      return NextResponse.json(
        { error: "يجب إنشاء الملف الشخصي قبل الإرسال" },
        { status: 400 }
      );
    }

    if (messageType === "text" && (!content || !content.trim())) {
      return NextResponse.json(
        { error: "لا يمكن إرسال رسالة فارغة" },
        { status: 400 }
      );
    }

    // Update sender's presence heartbeat & clear typing indicator
    await db
      .update(chatUsers)
      .set({
        status: "online",
        isTyping: false,
        lastSeenAt: new Date(),
      })
      .where(eq(chatUsers.id, senderId));

    const [inserted] = await db
      .insert(chatMessages)
      .values({
        roomId,
        senderId,
        senderName,
        senderAvatar,
        senderColor,
        senderBadge,
        messageType,
        content: content.trim(),
        mediaUrl,
        mediaMeta:
          typeof mediaMeta === "string"
            ? mediaMeta
            : mediaMeta
            ? JSON.stringify(mediaMeta)
            : null,
        replyToId: replyToId ? Number(replyToId) : null,
        replyToName,
        replyToPreview,
        reactions: "{}",
      })
      .returning();

    const snapshot = await getChatSnapshot(roomId);

    return NextResponse.json({
      message: inserted,
      ...snapshot,
    });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return NextResponse.json(
      { error: "تعذر إرسال الرسالة" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureChatSchemaAndSeed();

    const body = await req.json();
    const { messageId, emoji, userName, roomId = "global" } = body;

    if (!messageId || !emoji || !userName) {
      return NextResponse.json(
        { error: "بيانات التفاعل غير مكتملة" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, Number(messageId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "الرسالة غير موجودة" }, { status: 404 });
    }

    let reactions: Record<string, string[]> = {};
    try {
      reactions = JSON.parse(existing[0].reactions || "{}");
    } catch {
      reactions = {};
    }

    const currentList = reactions[emoji] || [];
    if (currentList.includes(userName)) {
      reactions[emoji] = currentList.filter((u) => u !== userName);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji] = [...currentList, userName];
    }

    await db
      .update(chatMessages)
      .set({ reactions: JSON.stringify(reactions) })
      .where(eq(chatMessages.id, Number(messageId)));

    const snapshot = await getChatSnapshot(roomId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Error in PATCH /api/messages:", error);
    return NextResponse.json(
      { error: "تعذر تحديث التفاعل" },
      { status: 500 }
    );
  }
}
