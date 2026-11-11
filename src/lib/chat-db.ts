import { db, pool } from "@/db";
import { chatMessages, chatUsers, ChatMessage, ChatUser } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { generatePlayableWavDataUri, generateWaveformPeaks } from "./audio-synth";

let initialized = false;

export const ROOMS = [
  {
    id: "global",
    name: "الصالون العام المباشر",
    description: "الدردشة الجماعية الفورية لجميع المتواجدين في الموقع",
    icon: "globe",
  },
  {
    id: "media",
    name: "استوديو الصور والمرئيات",
    description: "مساحة مشاركة المقاطع المرئية، اللقطات، والتسجيلات الصوتية",
    icon: "sparkles",
  },
  {
    id: "tech",
    name: "مجلس التقنية والإبداع",
    description: "نقاشات البرمجة، التصميم، وتجارب الويب التفاعلية",
    icon: "cpu",
  },
] as const;

export const AVATAR_PRESETS = [
  { id: "falcon", emoji: "🦅", label: "صقر الجزيرة", color: "from-indigo-500 to-cyan-400" },
  { id: "star", emoji: "✨", label: "نجم سهيل", color: "from-violet-500 to-fuchsia-500" },
  { id: "wave", emoji: "🌊", label: "موج الخليج", color: "from-cyan-500 to-teal-400" },
  { id: "flame", emoji: "🔥", label: "شعلة الإبداع", color: "from-amber-500 to-rose-500" },
  { id: "crown", emoji: "👑", label: "النخبة", color: "from-emerald-500 to-teal-500" },
  { id: "rocket", emoji: "🚀", label: "رائد فضاء", color: "from-blue-500 to-indigo-600" },
  { id: "headphones", emoji: "🎧", label: "صوت السهر", color: "from-pink-500 to-rose-500" },
  { id: "palm", emoji: "🌴", label: "واحة النخيل", color: "from-teal-500 to-emerald-400" },
];

export async function ensureChatSchemaAndSeed() {
  if (initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      color TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT 'متصل الآن في صالون تواصل',
      role_badge TEXT NOT NULL DEFAULT 'عضو نشط',
      status TEXT NOT NULL DEFAULT 'online',
      is_typing BOOLEAN NOT NULL DEFAULT FALSE,
      typing_room TEXT DEFAULT 'global',
      typing_updated_at TIMESTAMP DEFAULT NOW(),
      last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
      joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_simulated BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      room_id TEXT NOT NULL DEFAULT 'global',
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      sender_color TEXT NOT NULL,
      sender_badge TEXT NOT NULL DEFAULT 'عضو نشط',
      message_type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL DEFAULT '',
      media_url TEXT,
      media_meta TEXT,
      reply_to_id INTEGER,
      reply_to_name TEXT,
      reply_to_preview TEXT,
      reactions TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const existingUsers = await db.select().from(chatUsers).limit(1);
  if (existingUsers.length === 0) {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

    await db.insert(chatUsers).values([
      {
        id: "sim-sara",
        name: "سارة العتيبي",
        avatar: "✨",
        color: "from-violet-500 to-fuchsia-500",
        bio: "مصممة واجهات تفاعلية • أحب التصوير الليلي ☕",
        roleBadge: "مضيفة الصالون",
        status: "online",
        isTyping: false,
        typingRoom: "global",
        lastSeenAt: now,
        joinedAt: fiveMinAgo,
        isSimulated: true,
      },
      {
        id: "sim-faisal",
        name: "فيصل الحربي",
        avatar: "🦅",
        color: "from-indigo-500 to-cyan-400",
        bio: "مهندس صوتيات ومرئيات مباشر 🎙️",
        roleBadge: "مبدع صوتي",
        status: "online",
        isTyping: false,
        typingRoom: "global",
        lastSeenAt: now,
        joinedAt: fiveMinAgo,
        isSimulated: true,
      },
      {
        id: "sim-layan",
        name: "ليان القحطاني",
        avatar: "🎧",
        color: "from-pink-500 to-rose-500",
        bio: "في استراحة قصيرة.. أعود بعد قليل",
        roleBadge: "عضو مميز",
        status: "away",
        isTyping: false,
        typingRoom: "global",
        lastSeenAt: twoMinAgo,
        joinedAt: fiveMinAgo,
        isSimulated: true,
      },
      {
        id: "sim-omar",
        name: "عمر الدوسري",
        avatar: "🚀",
        color: "from-emerald-500 to-teal-500",
        bio: "غادر الموقع مؤخراً",
        roleBadge: "مطور ويب",
        status: "offline",
        isTyping: false,
        typingRoom: "global",
        lastSeenAt: fiveMinAgo,
        joinedAt: fiveMinAgo,
        isSimulated: true,
      },
    ]);
  }

  const existingMessages = await db.select().from(chatMessages).limit(1);
  if (existingMessages.length === 0) {
    const voiceDataUri = generatePlayableWavDataUri(4.2, "warm");
    const voiceWaveform = generateWaveformPeaks(36, 7);

    await db.insert(chatMessages).values([
      {
        roomId: "global",
        senderId: "system",
        senderName: "نظام تواصل الفوري",
        senderAvatar: "🛡️",
        senderColor: "from-indigo-500 to-cyan-400",
        senderBadge: "النظام",
        messageType: "system",
        content:
          "مرحباً بكم في صالون تواصل المباشر! جميع الرسائل والصور والفيديوهات والصوتيات تصل فوراً لكل المتواجدين في المتصفح مع رصد لحظي لحالة الاتصال.",
        reactions: JSON.stringify({ "🔥": ["سارة العتيبي", "فيصل الحربي"] }),
      },
      {
        roomId: "global",
        senderId: "sim-sara",
        senderName: "سارة العتيبي",
        senderAvatar: "✨",
        senderColor: "from-violet-500 to-fuchsia-500",
        senderBadge: "مضيفة الصالون",
        messageType: "image",
        content:
          "أهلاً بالجميع في سهرتنا اليوم! شاركونا لقطاتكم أو رسائلكم الصوتية مباشرة من المتصفح 🌃✨",
        mediaUrl:
          "https://images.pexels.com/photos/34672606/pexels-photo-34672606.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        mediaMeta: JSON.stringify({
          fileName: "riyadh-lounge-night.jpg",
          mimeType: "image/jpeg",
        }),
        reactions: JSON.stringify({ "❤️": ["فيصل الحربي"], "✨": ["ليان القحطاني"] }),
      },
      {
        roomId: "global",
        senderId: "sim-faisal",
        senderName: "فيصل الحربي",
        senderAvatar: "🦅",
        senderColor: "from-indigo-500 to-cyan-400",
        senderBadge: "مبدع صوتي",
        messageType: "audio",
        content: "رسالة صوتية ترحيبية لجميع الأعضاء المتصلين الآن 🎙️",
        mediaUrl: voiceDataUri,
        mediaMeta: JSON.stringify({
          duration: 4.2,
          waveform: voiceWaveform,
          mimeType: "audio/wav",
        }),
        reactions: JSON.stringify({ "🎧": ["سارة العتيبي"] }),
      },
      {
        roomId: "global",
        senderId: "sim-faisal",
        senderName: "فيصل الحربي",
        senderAvatar: "🦅",
        senderColor: "from-indigo-500 to-cyan-400",
        senderBadge: "مبدع صوتي",
        messageType: "video",
        content: "لقطة فيديو سريعة لأجواء المدينة الليلية بدقة عالية 🎬",
        mediaUrl:
          "https://videos.pexels.com/video-files/30390610/13023743_3840_2160_30fps.mp4",
        mediaMeta: JSON.stringify({
          duration: 15,
          poster:
            "https://images.pexels.com/videos/30390610/pexels-photo-30390610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
          mimeType: "video/mp4",
        }),
        reactions: JSON.stringify({ "🔥": ["سارة العتيبي"] }),
      },
    ]);
  }

  initialized = true;
}

/**
 * Ultra-accurate presence sweep:
 * - Any real browser session (`is_simulated = false`) that has not sent a heartbeat
 *   within the last 10 seconds is immediately transitioned to `offline`.
 * - Any user whose `is_typing = true` has not updated typing within 5 seconds is cleared.
 */
export async function refreshPresenceStates() {
  await ensureChatSchemaAndSeed();

  // Clear stale typing indicators older than 5 seconds
  await pool.query(`
    UPDATE chat_users
    SET is_typing = FALSE
    WHERE is_typing = TRUE
      AND typing_updated_at < NOW() - INTERVAL '5 seconds'
  `);

  // Mark real browser users who stopped sending heartbeats (> 11 seconds) as offline
  await pool.query(`
    UPDATE chat_users
    SET status = 'offline',
        is_typing = FALSE
    WHERE is_simulated = FALSE
      AND status != 'offline'
      AND last_seen_at < NOW() - INTERVAL '11 seconds'
  `);
}

export async function getChatSnapshot(roomId = "global"): Promise<{
  users: ChatUser[];
  messages: ChatMessage[];
  serverTime: string;
}> {
  await refreshPresenceStates();

  const allUsers = await db
    .select()
    .from(chatUsers)
    .orderBy(desc(chatUsers.lastSeenAt));

  // Sort online first, then away, then offline
  const statusWeight: Record<string, number> = {
    online: 0,
    away: 1,
    offline: 2,
  };
  allUsers.sort((a, b) => {
    const wa = statusWeight[a.status] ?? 3;
    const wb = statusWeight[b.status] ?? 3;
    if (wa !== wb) return wa - wb;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });

  const roomMessages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.id))
    .limit(80);

  return {
    users: allUsers,
    messages: roomMessages.reverse(),
    serverTime: new Date().toISOString(),
  };
}
