import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, chatUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureChatSchemaAndSeed, getChatSnapshot } from "@/lib/chat-db";
import { generatePlayableWavDataUri, generateWaveformPeaks } from "@/lib/audio-synth";

const SAMPLE_PHOTOS = [
  {
    url: "https://images.pexels.com/photos/6435022/pexels-photo-6435022.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    caption: "إضاءة معمارية ساحرة من جولتي المسائية اليوم 📸🌃",
  },
  {
    url: "https://images.pexels.com/photos/6016961/pexels-photo-6016961.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    caption: "أجواء المقهى والنيون تفتح النفس للدردشة السريعة ☕✨",
  },
  {
    url: "https://images.pexels.com/photos/8314825/pexels-photo-8314825.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    caption: "تصميم عصري مميز التقطته قبل قليل 🏙️🔥",
  },
];

const SAMPLE_VIDEOS = [
  {
    url: "https://videos.pexels.com/video-files/17686937/17686937-uhd_3840_2160_30fps.mp4",
    poster:
      "https://images.pexels.com/videos/17686937/beograd-oluja-17686937.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
    caption: "شاهدوا هذا المقطع المباشر لأضواء المدينة في المساء 🎬⚡",
  },
  {
    url: "https://videos.pexels.com/video-files/30390610/13023743_3840_2160_30fps.mp4",
    poster:
      "https://images.pexels.com/videos/30390610/pexels-photo-30390610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
    caption: "لقطة فيديو سريعة بجودة عالية شاركتها معكم الآن 🎥✨",
  },
];

const SAMPLE_TEXTS = [
  "يا هلا والله! سرعة وصول الرسائل في الموقع رهيبة وبدون أي تقطيع 🚀🔥",
  "أعجبني جداً نظام رصد المتصلين، أول ما يطلع أي شخص يبين فوراً أنه أوفلاين 👌",
  "جربتوا إرسال التسجيلات الصوتية؟ الموجات الصوتية تشتغل بشكل احترافي جداً 🎙️✨",
  "مساء النور جميعاً! منورين الصالون العام اليوم 🌟",
];

export async function POST(req: NextRequest) {
  try {
    await ensureChatSchemaAndSeed();

    const body = await req.json();
    const {
      action = "incoming_message",
      targetUserId,
      nextStatus,
      mediaKind = "random",
      roomId = "global",
    } = body;

    if (action === "toggle_presence" && targetUserId) {
      const existing = await db
        .select()
        .from(chatUsers)
        .where(eq(chatUsers.id, targetUserId))
        .limit(1);

      if (existing.length > 0) {
        const user = existing[0];
        const newStatus =
          nextStatus ||
          (user.status === "online"
            ? "offline"
            : user.status === "offline"
            ? "online"
            : "offline");

        await db
          .update(chatUsers)
          .set({
            status: newStatus,
            isTyping: false,
            lastSeenAt: new Date(),
          })
          .where(eq(chatUsers.id, targetUserId));

        await db.insert(chatMessages).values({
          roomId,
          senderId: user.id,
          senderName: user.name,
          senderAvatar: user.avatar,
          senderColor: user.color,
          senderBadge: user.roleBadge,
          messageType: "system",
          content:
            newStatus === "offline"
              ? `غادر ${user.name} الموقع وتم تحويل حالته تلقائياً إلى غير متصل (Offline) 🔴`
              : newStatus === "away"
              ? `أصبح ${user.name} في وضع بالخلفية / بعيد (Away) 🟡`
              : `عاد ${user.name} إلى الموقع وأصبح متصلاً الآن (Online) 🟢`,
          reactions: "{}",
        });
      }

      const snapshot = await getChatSnapshot(roomId);
      return NextResponse.json(snapshot);
    }

    // Otherwise simulate an incoming message from one of the simulated users
    const simUsers = await db
      .select()
      .from(chatUsers)
      .where(eq(chatUsers.isSimulated, true));

    const onlineSims = simUsers.filter((u) => u.status === "online");
    const chosen =
      onlineSims[Math.floor(Math.random() * onlineSims.length)] ||
      simUsers[0];

    if (chosen) {
      // Ensure chosen user is marked online
      await db
        .update(chatUsers)
        .set({ status: "online", isTyping: false, lastSeenAt: new Date() })
        .where(eq(chatUsers.id, chosen.id));

      const kinds = ["text", "audio", "image", "video"] as const;
      const selectedKind =
        mediaKind === "random"
          ? kinds[Math.floor(Math.random() * kinds.length)]
          : mediaKind;

      if (selectedKind === "image") {
        const photo =
          SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)];
        await db.insert(chatMessages).values({
          roomId,
          senderId: chosen.id,
          senderName: chosen.name,
          senderAvatar: chosen.avatar,
          senderColor: chosen.color,
          senderBadge: chosen.roleBadge,
          messageType: "image",
          content: photo.caption,
          mediaUrl: photo.url,
          mediaMeta: JSON.stringify({
            fileName: "shared-moment.jpg",
            mimeType: "image/jpeg",
          }),
          reactions: "{}",
        });
      } else if (selectedKind === "video") {
        const vid =
          SAMPLE_VIDEOS[Math.floor(Math.random() * SAMPLE_VIDEOS.length)];
        await db.insert(chatMessages).values({
          roomId,
          senderId: chosen.id,
          senderName: chosen.name,
          senderAvatar: chosen.avatar,
          senderColor: chosen.color,
          senderBadge: chosen.roleBadge,
          messageType: "video",
          content: vid.caption,
          mediaUrl: vid.url,
          mediaMeta: JSON.stringify({
            duration: 15,
            poster: vid.poster,
            mimeType: "video/mp4",
          }),
          reactions: "{}",
        });
      } else if (selectedKind === "audio") {
        const duration = Number((3.2 + Math.random() * 2.5).toFixed(1));
        const wavUri = generatePlayableWavDataUri(duration, "bright");
        const peaks = generateWaveformPeaks(36, Math.floor(Math.random() * 20));
        await db.insert(chatMessages).values({
          roomId,
          senderId: chosen.id,
          senderName: chosen.name,
          senderAvatar: chosen.avatar,
          senderColor: chosen.color,
          senderBadge: chosen.roleBadge,
          messageType: "audio",
          content: "تسجيل صوتي سريع للمتواجدين في الدردشة 🎙️✨",
          mediaUrl: wavUri,
          mediaMeta: JSON.stringify({
            duration,
            waveform: peaks,
            mimeType: "audio/wav",
          }),
          reactions: "{}",
        });
      } else {
        const text =
          SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
        await db.insert(chatMessages).values({
          roomId,
          senderId: chosen.id,
          senderName: chosen.name,
          senderAvatar: chosen.avatar,
          senderColor: chosen.color,
          senderBadge: chosen.roleBadge,
          messageType: "text",
          content: text,
          reactions: "{}",
        });
      }
    }

    const snapshot = await getChatSnapshot(roomId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Error in POST /api/simulate:", error);
    return NextResponse.json(
      { error: "Simulation failed" },
      { status: 500 }
    );
  }
}
