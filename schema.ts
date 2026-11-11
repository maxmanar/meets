import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const chatUsers = pgTable("chat_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  color: text("color").notNull(),
  bio: text("bio").notNull().default("متصل الآن في صالون تواصل"),
  roleBadge: text("role_badge").notNull().default("عضو نشط"),
  status: text("status").notNull().default("online"), // 'online' | 'away' | 'offline'
  isTyping: boolean("is_typing").notNull().default(false),
  typingRoom: text("typing_room").default("global"),
  typingUpdatedAt: timestamp("typing_updated_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  isSimulated: boolean("is_simulated").notNull().default(false),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull().default("global"),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderAvatar: text("sender_avatar").notNull(),
  senderColor: text("sender_color").notNull(),
  senderBadge: text("sender_badge").notNull().default("عضو نشط"),
  messageType: text("message_type").notNull().default("text"), // 'text' | 'image' | 'video' | 'audio' | 'system'
  content: text("content").notNull().default(""),
  mediaUrl: text("media_url"),
  mediaMeta: text("media_meta"), // JSON string: { duration, waveform, fileName, mimeType }
  replyToId: integer("reply_to_id"),
  replyToName: text("reply_to_name"),
  replyToPreview: text("reply_to_preview"),
  reactions: text("reactions").notNull().default("{}"), // JSON string: Record<string, string[]>
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChatUser = typeof chatUsers.$inferSelect;
export type NewChatUser = typeof chatUsers.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
