"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatUser } from "@/db/schema";
import { ROOMS } from "@/lib/chat-constants";
import {
  generatePlayableWavDataUri,
  generateWaveformPeaks,
} from "@/lib/audio-synth";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { ProfileModal } from "./ProfileModal";
import {
  Send,
  Mic,
  Image as ImageIcon,
  Video,
  Smile,
  Users,
  Radio,
  Sparkles,
  Reply,
  X,
  Search,
  Volume2,
  LogOut,
  RefreshCw,
  CheckCheck,
  Maximize2,
  Square,
  Upload,
  Wifi,
  WifiOff,
  UserPlus,
  Clock,
  ShieldAlert,
  PlayCircle,
  MessageSquarePlus,
} from "lucide-react";

const QUICK_EMOJIS = ["🔥", "❤️", "😂", "✨", "👏", "🎧"];

const QUICK_GALLERY_IMAGES = [
  {
    title: "إطلالة المساء المعمارية",
    url: "https://images.pexels.com/photos/6435022/pexels-photo-6435022.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "أضواء النيون الكلاسيكية",
    url: "https://images.pexels.com/photos/6016961/pexels-photo-6016961.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "جلسة هادئة في المقهى",
    url: "https://images.pexels.com/photos/34672606/pexels-photo-34672606.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "تصميم ليلي عصري",
    url: "https://images.pexels.com/photos/8314825/pexels-photo-8314825.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
];

const QUICK_GALLERY_VIDEOS = [
  {
    title: "تايم لابس أضواء المدينة 4K",
    url: "https://videos.pexels.com/video-files/30390610/13023743_3840_2160_30fps.mp4",
    poster:
      "https://images.pexels.com/videos/30390610/pexels-photo-30390610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
  },
  {
    title: "عاصفة برق ليلية سينمائية",
    url: "https://videos.pexels.com/video-files/17686937/17686937-uhd_3840_2160_30fps.mp4",
    poster:
      "https://images.pexels.com/videos/17686937/beograd-oluja-17686937.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200",
  },
];

interface StoredProfile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  bio: string;
  roleBadge: string;
}

export function ChatLounge() {
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  const [activeRoom, setActiveRoom] = useState<string>("global");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<
    "all" | "online" | "offline"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);

  // Composer state
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaDrawer, setMediaDrawer] = useState<
    "none" | "image" | "video" | "audio"
  >("none");

  // Pending attachment preview before sending
  const [pendingMedia, setPendingMedia] = useState<{
    type: "image" | "video" | "audio";
    url: string;
    meta: Record<string, unknown>;
    label: string;
  } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingMode, setRecordingMode] = useState<"mic" | "synth">("mic");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Lightbox state for fullscreen images
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string;
    sender?: string;
  } | null>(null);

  // Connection telemetry state
  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncLatency, setLastSyncLatency] = useState<number>(18);
  const [manualOfflineMode, setManualOfflineMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const prevMessageCountRef = useRef<number>(0);

  // 1. Check stored profile on mount; if none, open onboarding modal immediately
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tawasul_profile_v1");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredProfile;
        if (parsed && parsed.id && parsed.name) {
          setProfile(parsed);
          setIsProfileModalOpen(false);
          setHasCheckedStorage(true);
          // Re-announce online presence immediately
          fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...parsed, roomId: "global" }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.users) setUsers(data.users);
              if (data.messages) setMessages(data.messages);
            })
            .catch(() => {});
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    setIsProfileModalOpen(true);
    setHasCheckedStorage(true);
  }, []);

  // 2. Sync function (fetches messages & presence every 1.6s without interruption)
  const syncChat = useCallback(async () => {
    const t0 = performance.now();
    try {
      const vis =
        typeof document !== "undefined" ? document.visibilityState : "visible";
      const query = new URLSearchParams({
        roomId: activeRoom,
        visibility: vis,
      });
      if (profile?.id && !manualOfflineMode) {
        query.set("userId", profile.id);
      }

      const res = await fetch(`/api/sync?${query.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Sync error");
      const data = await res.json();
      const dt = Math.max(8, Math.round(performance.now() - t0));
      setLastSyncLatency(dt);
      setIsConnected(true);
      if (Array.isArray(data.users)) setUsers(data.users);
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      setIsConnected(false);
    }
  }, [activeRoom, profile?.id, manualOfflineMode]);

  useEffect(() => {
    syncChat();
    const interval = setInterval(syncChat, 1600);
    return () => clearInterval(interval);
  }, [syncChat]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // 3. Ultra-Accurate Browser Exit / Tab Visibility Presence Detection
  useEffect(() => {
    if (!profile?.id) return;

    const handleVisibilityChange = () => {
      if (manualOfflineMode) return;
      const nextStatus =
        document.visibilityState === "hidden" ? "away" : "online";
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          status: nextStatus,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    const handleLeavePage = () => {
      const payload = JSON.stringify({
        userId: profile.id,
        announce: true,
        roomId: activeRoom,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/presence/leave", payload);
      } else {
        fetch("/api/presence/leave", {
          method: "POST",
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleLeavePage);
    window.addEventListener("beforeunload", handleLeavePage);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleLeavePage);
      window.removeEventListener("beforeunload", handleLeavePage);
    };
  }, [profile?.id, activeRoom, manualOfflineMode]);

  // 4. Handle Profile Creation / Edit
  const handleSaveProfile = async (formData: {
    name: string;
    avatar: string;
    color: string;
    bio: string;
    roleBadge: string;
  }) => {
    const id =
      profile?.id ||
      `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const newProfile: StoredProfile = {
      id,
      ...formData,
    };

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newProfile,
        roomId: activeRoom,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setProfile(newProfile);
      setManualOfflineMode(false);
      localStorage.setItem("tawasul_profile_v1", JSON.stringify(newProfile));
      if (data.users) setUsers(data.users);
      if (data.messages) setMessages(data.messages);
      setIsProfileModalOpen(false);
    }
  };

  // 5. Broadcast Typing Indicator when user types
  const handleTextChange = (val: string) => {
    setText(val);
    if (!profile?.id || manualOfflineMode) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          status: "online",
          isTyping: val.trim().length > 0,
          typingRoom: activeRoom,
        }),
      }).catch(() => {});
    }
  };

  // 6. Send Message (Text, Image, Video, or Voice Note)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) {
      setIsProfileModalOpen(true);
      return;
    }

    const messageType = pendingMedia ? pendingMedia.type : "text";
    if (messageType === "text" && !text.trim()) return;

    setSending(true);
    try {
      const payload = {
        roomId: activeRoom,
        senderId: profile.id,
        senderName: profile.name,
        senderAvatar: profile.avatar,
        senderColor: profile.color,
        senderBadge: profile.roleBadge,
        messageType,
        content:
          text.trim() ||
          (messageType === "audio"
            ? "رسالة صوتية مسجلة 🎙️"
            : messageType === "image"
            ? "صورة مشاركة 📸"
            : messageType === "video"
            ? "مقطع فيديو مشارك 🎬"
            : ""),
        mediaUrl: pendingMedia ? pendingMedia.url : null,
        mediaMeta: pendingMedia ? pendingMedia.meta : null,
        replyToId: replyTarget?.id || null,
        replyToName: replyTarget?.senderName || null,
        replyToPreview: replyTarget
          ? replyTarget.content.slice(0, 70) ||
            (replyTarget.messageType === "audio"
              ? "🎵 رسالة صوتية"
              : replyTarget.messageType === "image"
              ? "📷 صورة"
              : "🎬 فيديو")
          : null,
      };

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setText("");
        setPendingMedia(null);
        setReplyTarget(null);
        setMediaDrawer("none");
        setShowEmojiPicker(false);
        setManualOfflineMode(false);
        if (data.users) setUsers(data.users);
        if (data.messages) setMessages(data.messages);
      }
    } finally {
      setSending(false);
    }
  };

  // 7. File Upload Handlers for Images, Videos, and Audio
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "image" | "video" | "audio"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingMedia({
          type: kind,
          url: reader.result,
          label: file.name,
          meta: {
            fileName: file.name,
            mimeType: file.type,
            duration: kind === "audio" ? 5 : undefined,
            waveform:
              kind === "audio" ? generateWaveformPeaks(36, 12) : undefined,
          },
        });
        setMediaDrawer("none");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // 8. Interactive Voice Note Recording (Real Microphone + Smart Synth Fallback)
  const startVoiceRecording = async () => {
    if (!profile) {
      setIsProfileModalOpen(true);
      return;
    }

    setRecordingSeconds(0);
    setIsRecording(true);

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      ) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setRecordingMode("mic");
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        return;
      }
    } catch {
      // Fallback to smart synthesizer if hardware microphone isn't accessible
    }

    setRecordingMode("synth");
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const finishAndSendVoiceNote = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const finalDuration = Math.max(2, recordingSeconds || 3);
    const peaks = generateWaveformPeaks(36, Date.now() % 30);

    const sendAudioUrl = async (dataUrl: string) => {
      if (!profile) return;
      setSending(true);
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: activeRoom,
            senderId: profile.id,
            senderName: profile.name,
            senderAvatar: profile.avatar,
            senderColor: profile.color,
            senderBadge: profile.roleBadge,
            messageType: "audio",
            content:
              text.trim() || `رسالة صوتية فورية (${finalDuration} ثوانٍ) 🎙️`,
            mediaUrl: dataUrl,
            mediaMeta: {
              duration: finalDuration,
              waveform: peaks,
              mimeType: "audio/wav",
            },
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setText("");
          if (data.users) setUsers(data.users);
          if (data.messages) setMessages(data.messages);
        }
      } finally {
        setSending(false);
      }
    };

    if (
      recordingMode === "mic" &&
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size > 100) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              sendAudioUrl(reader.result);
            }
          };
          reader.readAsDataURL(blob);
        } else {
          const wav = generatePlayableWavDataUri(finalDuration, "warm");
          sendAudioUrl(wav);
        }
      };
      recorder.stop();
    } else {
      const wav = generatePlayableWavDataUri(finalDuration, "warm");
      await sendAudioUrl(wav);
    }

    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // 9. Toggle Message Reaction
  const handleToggleReaction = async (messageId: number, emoji: string) => {
    if (!profile) {
      setIsProfileModalOpen(true);
      return;
    }
    const res = await fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        emoji,
        userName: profile.name,
        roomId: activeRoom,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.users) setUsers(data.users);
      if (data.messages) setMessages(data.messages);
    }
  };

  // 10. Simulate Peer Activity or Presence Change (For instant testing)
  const handleSimulateIncoming = async (
    mediaKind: "text" | "audio" | "image" | "video" | "random" = "random"
  ) => {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "incoming_message",
        mediaKind,
        roomId: activeRoom,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.users) setUsers(data.users);
      if (data.messages) setMessages(data.messages);
    }
  };

  const handleToggleUserPresence = async (
    targetUserId: string,
    nextStatus?: "online" | "offline" | "away"
  ) => {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_presence",
        targetUserId,
        nextStatus,
        roomId: activeRoom,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.users) setUsers(data.users);
      if (data.messages) setMessages(data.messages);
    }
  };

  // Toggle current user's own session between Online & Offline to test instant detection
  const handleSelfOfflineTest = async () => {
    if (!profile) return;
    if (!manualOfflineMode) {
      setManualOfflineMode(true);
      await fetch("/api/presence/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          announce: true,
          roomId: activeRoom,
        }),
      });
      await syncChat();
    } else {
      setManualOfflineMode(false);
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          roomId: activeRoom,
        }),
      });
      await syncChat();
    }
  };

  // Computed counts and filtered lists
  const onlineUsers = useMemo(
    () => users.filter((u) => u.status === "online"),
    [users]
  );
  const awayUsers = useMemo(
    () => users.filter((u) => u.status === "away"),
    [users]
  );
  const offlineUsers = useMemo(
    () => users.filter((u) => u.status === "offline"),
    [users]
  );

  const filteredUsers = useMemo(() => {
    if (presenceFilter === "online") {
      return users.filter((u) => u.status === "online" || u.status === "away");
    }
    if (presenceFilter === "offline") {
      return users.filter((u) => u.status === "offline");
    }
    return users;
  }, [users, presenceFilter]);

  const typingUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.isTyping &&
          u.status === "online" &&
          u.id !== profile?.id &&
          (!u.typingRoom || u.typingRoom === activeRoom)
      ),
    [users, profile?.id, activeRoom]
  );

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.trim().toLowerCase();
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const currentRoomObj =
    ROOMS.find((r) => r.id === activeRoom) || ROOMS[0];

  const formatTime = (dateVal: string | Date) => {
    try {
      const d = new Date(dateVal);
      return d.toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070A12] text-[#F8FAFC] flex flex-col select-none sm:select-auto">
      {/* Ambient Radial Aura Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 18% 15%, rgba(99, 102, 241, 0.14), transparent 45%), radial-gradient(circle at 82% 85%, rgba(6, 182, 212, 0.12), transparent 45%)",
        }}
      />

      {/* Profile Onboarding / Edit Modal */}
      {hasCheckedStorage && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          canClose={Boolean(profile)}
          initialName={profile?.name || ""}
          initialAvatar={profile?.avatar || "🦅"}
          initialColor={profile?.color || "from-indigo-500 to-cyan-400"}
          initialBio={profile?.bio || "متصل الآن في صالون تواصل المباشر"}
          initialBadge={profile?.roleBadge || "عضو نشط"}
          onlineCount={onlineUsers.length}
          onClose={() => setIsProfileModalOpen(false)}
          onSubmit={handleSaveProfile}
        />
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 left-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.caption || "صورة مكبرة"}
            className="max-h-[82vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl border border-white/15"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxImage.caption && (
            <div className="mt-4 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md text-sm text-white">
              <span className="font-bold text-cyan-300 ml-2">
                {lightboxImage.sender}:
              </span>
              <span>{lightboxImage.caption}</span>
            </div>
          )}
        </div>
      )}

      {/* TOP TELEMETRY & NAVIGATION HEADER */}
      <header className="relative z-20 h-16 px-4 lg:px-6 bg-[#0F1626]/85 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
        {/* Brand + Active Room Switcher */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.5)] shrink-0">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold font-heading tracking-tight text-white truncate">
                تواصُل
              </h1>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 online-pulse" />
                بث حي بلا انقطاع
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate hidden sm:block">
              {currentRoomObj.description}
            </p>
          </div>

          {/* Room Pills */}
          <div className="hidden xl:flex items-center gap-1.5 mr-4 bg-[#070A12]/80 p-1 rounded-xl border border-white/10">
            {ROOMS.map((room) => {
              const active = room.id === activeRoom;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveRoom(room.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {room.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center / Left Controls: Instant Simulation, Presence Status, Profile Card */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Interactive Incoming Media Simulator (For testing live multi-user reception) */}
          <div className="hidden lg:flex items-center gap-1 bg-[#070A12]/90 px-2.5 py-1.5 rounded-xl border border-indigo-500/25">
            <span className="text-[11px] text-indigo-300 font-semibold ml-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              استلام فوري تجريبي:
            </span>
            <button
              type="button"
              onClick={() => handleSimulateIncoming("text")}
              className="px-2 py-1 rounded-lg text-[11px] bg-white/5 hover:bg-indigo-500/25 text-slate-200 transition cursor-pointer"
              title="محاكاة رسالة نصية واردة من متصل الآن"
            >
              نص 💬
            </button>
            <button
              type="button"
              onClick={() => handleSimulateIncoming("audio")}
              className="px-2 py-1 rounded-lg text-[11px] bg-white/5 hover:bg-cyan-500/25 text-slate-200 transition cursor-pointer"
              title="محاكاة رسالة صوتية واردة"
            >
              صوتية 🎙️
            </button>
            <button
              type="button"
              onClick={() => handleSimulateIncoming("image")}
              className="px-2 py-1 rounded-lg text-[11px] bg-white/5 hover:bg-emerald-500/25 text-slate-200 transition cursor-pointer"
              title="محاكاة صورة واردة"
            >
              صورة 📸
            </button>
            <button
              type="button"
              onClick={() => handleSimulateIncoming("video")}
              className="px-2 py-1 rounded-lg text-[11px] bg-white/5 hover:bg-purple-500/25 text-slate-200 transition cursor-pointer"
              title="محاكاة فيديو وارد"
            >
              فيديو 🎬
            </button>
          </div>

          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              isSearchOpen
                ? "bg-indigo-600/25 border-indigo-400 text-white"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
            title="البحث في الرسائل"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Self Presence Toggle Button (To test instant Online <-> Offline detection) */}
          {profile && (
            <button
              type="button"
              onClick={handleSelfOfflineTest}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                manualOfflineMode
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
              }`}
              title="اختبر كاشف الخروج اللحظي: اضغط لمحاكاة مغادرة الموقع أو العودة"
            >
              {manualOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>غير متصل (إعادة اتصال)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>متصل ({lastSyncLatency}ms)</span>
                </>
              )}
            </button>
          )}

          {/* Current User Profile Button */}
          {profile ? (
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer"
              title="تعديل الملف الشخصي"
            >
              <div className="relative">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${profile.color} p-[1.5px]`}
                >
                  <div className="w-full h-full rounded-[6px] bg-[#0F1626] flex items-center justify-center text-sm overflow-hidden">
                    {profile.avatar.startsWith("data:image") ||
                    profile.avatar.startsWith("http") ? (
                      <img
                        src={profile.avatar}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{profile.avatar}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#070A12] ${
                    manualOfflineMode
                      ? "bg-slate-500"
                      : "bg-emerald-400 online-pulse"
                  }`}
                />
              </div>
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[110px]">
                  {profile.name}
                </p>
                <p className="text-[10px] text-cyan-400 leading-tight">
                  {manualOfflineMode ? "أوفلاين مؤقتاً" : "تعديل البروفايل"}
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>تسجيل بروفايل</span>
            </button>
          )}

          {/* Mobile Roster Drawer Button */}
          <button
            type="button"
            onClick={() => setMobileRosterOpen((prev) => !prev)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 text-xs font-bold"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="font-mono-num">{onlineUsers.length}</span>
          </button>
        </div>
      </header>

      {/* Search Bar Drawer if open */}
      {isSearchOpen && (
        <div className="relative z-20 px-4 lg:px-6 py-2.5 bg-[#0F1626]/95 border-b border-white/10 flex items-center gap-3">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في الرسائل أو باسم المرسل..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-white"
            >
              مسح
            </button>
          )}
        </div>
      )}

      {/* MAIN DUAL-PANE WORKSPACE */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* RIGHT SIDEBAR (in RTL): ULTRA-ACCURATE LIVE PRESENCE ROSTER */}
        <aside
          className={`${
            mobileRosterOpen
              ? "fixed inset-y-16 right-0 z-40 flex w-80"
              : "hidden lg:flex lg:w-80 xl:w-88"
          } flex-col bg-[#0F1626]/85 backdrop-blur-2xl border-l border-white/10 shrink-0 transition-all`}
        >
          {/* Roster Telemetry Header */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold font-heading text-white">
                  رادار المتواجدين اللحظي
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono-num font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 online-pulse" />
                {onlineUsers.length} متصل
              </span>
            </div>

            {/* Status Summary Pills */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#070A12]/90 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setPresenceFilter("all")}
                className={`py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  presenceFilter === "all"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                الكل ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setPresenceFilter("online")}
                className={`py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  presenceFilter === "online"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-emerald-300"
                }`}
              >
                متصل ({onlineUsers.length + awayUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setPresenceFilter("offline")}
                className={`py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  presenceFilter === "offline"
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                غادر ({offlineUsers.length})
              </button>
            </div>
          </div>

          {/* Connected & Offline Users List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredUsers.map((u) => {
              const isMe = u.id === profile?.id;
              const isCustomAvatar =
                u.avatar.startsWith("data:image") || u.avatar.startsWith("http");

              return (
                <div
                  key={u.id}
                  className={`group p-3 rounded-2xl border transition-all ${
                    u.status === "online"
                      ? "bg-[#131C31]/80 border-white/10 hover:border-indigo-500/40"
                      : u.status === "away"
                      ? "bg-[#131C31]/50 border-amber-500/20"
                      : "bg-[#090D16]/60 border-white/5 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar + Live Status Badge */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${u.color} p-[1.5px]`}
                        >
                          <div className="w-full h-full rounded-[10px] bg-[#0F1626] flex items-center justify-center text-lg overflow-hidden">
                            {isCustomAvatar ? (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{u.avatar}</span>
                            )}
                          </div>
                        </div>

                        {/* Status Dot */}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0F1626] ${
                            u.status === "online"
                              ? "bg-emerald-400 online-pulse"
                              : u.status === "away"
                              ? "bg-amber-400"
                              : "bg-slate-500"
                          }`}
                          title={
                            u.status === "online"
                              ? "متصل الآن"
                              : u.status === "away"
                              ? "بالخلفية / بعيد"
                              : "غادر الموقع (غير متصل)"
                          }
                        />
                      </div>

                      {/* Name, Badge, Typing or Bio */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-white truncate">
                            {u.name}
                          </span>
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              أنت
                            </span>
                          )}
                        </div>

                        {u.isTyping && u.status === "online" ? (
                          <p className="text-xs text-cyan-400 font-semibold flex items-center gap-1 mt-0.5 animate-pulse">
                            <span>يكتب رسالة الآن...</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {u.bio}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              u.status === "online"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : u.status === "away"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-slate-700/60 text-slate-300"
                            }`}
                          >
                            {u.status === "online"
                              ? "🟢 متصل الآن"
                              : u.status === "away"
                              ? "🟡 بالخلفية"
                              : "🔴 غير متصل (غادر)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Presence Test Toggle for Simulated Members */}
                    {u.isSimulated && (
                      <button
                        type="button"
                        onClick={() => handleToggleUserPresence(u.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border shrink-0 transition cursor-pointer ${
                          u.status === "online"
                            ? "bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
                            : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                        }`}
                        title={
                          u.status === "online"
                            ? "اضغط لمحاكاة خروج هذا العضو من الموقع ورؤية تحوله الفوري إلى أوفلاين"
                            : "اضغط لإعادة اتصال هذا العضو"
                        }
                      >
                        {u.status === "online" ? "محاكاة خروج" : "إعادة اتصال"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Presence Precision Info Footer */}
          <div className="p-3.5 bg-[#070A12]/90 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                فحص النبض كل 1.6 ثانية
              </span>
              <span className="font-mono-num text-slate-500">
                {isConnected ? "متزامن 100%" : "إعادة المزامنة..."}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              يرصد النظام إغلاق المتصفح فوراً عبر إشارة{" "}
              <code className="text-cyan-300 font-mono-num">Beacon</code> ويحول
              الحالة تلقائياً إلى <span className="text-rose-400 font-bold">غير متصل</span>.
            </p>
          </div>
        </aside>

        {/* CENTER / LEFT PANE: LIVE MESSAGE STREAM & MULTIMEDIA COMPOSER */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
          {/* Mobile Room Switcher & Quick Simulation Strip */}
          <div className="xl:hidden px-3 py-2 bg-[#0F1626]/60 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              {ROOMS.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveRoom(room.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                    activeRoom === room.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white/5 text-slate-400"
                  }`}
                >
                  {room.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSimulateIncoming("random")}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              رسالة تجريبية واردة
            </button>
          </div>

          {/* MESSAGE FEED STREAM */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5">
            {filteredMessages.map((msg) => {
              const isOwn = Boolean(profile && msg.senderId === profile.id);
              const isSystem = msg.messageType === "system";

              let parsedMeta: {
                duration?: number;
                waveform?: number[];
                poster?: string;
                fileName?: string;
              } = {};
              if (msg.mediaMeta) {
                try {
                  parsedMeta = JSON.parse(msg.mediaMeta);
                } catch {
                  parsedMeta = {};
                }
              }

              let parsedReactions: Record<string, string[]> = {};
              if (msg.reactions) {
                try {
                  parsedReactions = JSON.parse(msg.reactions);
                } catch {
                  parsedReactions = {};
                }
              }

              // Find sender's live status in roster
              const senderUser = users.find((u) => u.id === msg.senderId);
              const senderStatus = senderUser?.status || "online";

              if (isSystem) {
                const isOfflineNotice =
                  msg.content.includes("غادر") ||
                  msg.content.includes("غير متصل");
                return (
                  <div
                    key={msg.id}
                    className="flex justify-center my-2 animate-fadeIn"
                  >
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md shadow-sm ${
                        isOfflineNotice
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                          : "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                      }`}
                    >
                      <span>{msg.content}</span>
                      <span className="text-[10px] text-slate-400 font-mono-num">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              }

              const isCustomSenderAvatar =
                msg.senderAvatar.startsWith("data:image") ||
                msg.senderAvatar.startsWith("http");

              return (
                <div
                  key={msg.id}
                  className={`group flex items-end gap-3 ${
                    isOwn ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  {/* Sender Avatar with Live Presence Dot */}
                  <div className="relative shrink-0 mb-1">
                    <div
                      className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${msg.senderColor} p-[1.5px] shadow-md`}
                    >
                      <div className="w-full h-full rounded-[14px] bg-[#0F1626] flex items-center justify-center text-base overflow-hidden">
                        {isCustomSenderAvatar ? (
                          <img
                            src={msg.senderAvatar}
                            alt={msg.senderName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{msg.senderAvatar}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#070A12] ${
                        senderStatus === "online"
                          ? "bg-emerald-400 online-pulse"
                          : senderStatus === "away"
                          ? "bg-amber-400"
                          : "bg-slate-500"
                      }`}
                      title={
                        senderStatus === "online"
                          ? "متصل الآن"
                          : senderStatus === "away"
                          ? "بعيد"
                          : "غير متصل"
                      }
                    />
                  </div>

                  {/* Message Bubble Column */}
                  <div
                    className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
                      isOwn ? "items-start" : "items-end"
                    }`}
                  >
                    {/* Sender Name, Role Badge & Timestamp */}
                    <div
                      className={`flex items-center gap-2 mb-1 px-1 text-xs ${
                        isOwn ? "flex-row" : "flex-row-reverse"
                      }`}
                    >
                      <span className="font-bold text-slate-200">
                        {msg.senderName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-300 border border-white/10">
                        {msg.senderBadge}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono-num">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Bubble Container */}
                    <div
                      className={`relative rounded-2xl p-3.5 sm:p-4 shadow-xl transition-all ${
                        isOwn
                          ? "bg-gradient-to-br from-[#312E81] via-[#3730A3] to-[#1E1B4B] text-white border border-indigo-400/30 rounded-br-sm"
                          : "bg-[#131C31]/95 text-[#F8FAFC] border border-white/10 rounded-bl-sm"
                      }`}
                    >
                      {/* Reply Quote Preview if replying */}
                      {msg.replyToId && (
                        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-black/25 border-r-2 border-cyan-400 text-xs">
                          <p className="font-bold text-cyan-300">
                            رداً على {msg.replyToName}
                          </p>
                          <p className="text-slate-300 truncate">
                            {msg.replyToPreview}
                          </p>
                        </div>
                      )}

                      {/* IMAGE ATTACHMENT */}
                      {msg.messageType === "image" && msg.mediaUrl && (
                        <div className="mb-2.5 overflow-hidden rounded-xl border border-white/15 bg-black/40 relative group/img">
                          <img
                            src={msg.mediaUrl}
                            alt={msg.content || "صورة مرسلة"}
                            onClick={() =>
                              setLightboxImage({
                                url: msg.mediaUrl!,
                                caption: msg.content,
                                sender: msg.senderName,
                              })
                            }
                            className="w-full max-h-80 object-cover cursor-zoom-in transition duration-300 group-hover/img:scale-[1.02]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: msg.mediaUrl!,
                                caption: msg.content,
                                sender: msg.senderName,
                              })
                            }
                            className="absolute top-2.5 left-2.5 p-2 rounded-lg bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition"
                            title="تكبير الصورة"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* VIDEO ATTACHMENT */}
                      {msg.messageType === "video" && msg.mediaUrl && (
                        <div className="mb-2.5 overflow-hidden rounded-xl border border-white/15 bg-black max-w-md">
                          <video
                            src={msg.mediaUrl}
                            poster={parsedMeta.poster}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full max-h-80 object-cover rounded-xl"
                          />
                        </div>
                      )}

                      {/* VOICE NOTE / AUDIO ATTACHMENT */}
                      {msg.messageType === "audio" && msg.mediaUrl && (
                        <div className="mb-2">
                          <VoiceNotePlayer
                            audioUrl={msg.mediaUrl}
                            duration={parsedMeta.duration || 4}
                            waveform={parsedMeta.waveform}
                            isOwn={isOwn}
                          />
                        </div>
                      )}

                      {/* Text Content / Caption */}
                      {msg.content && (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}

                      {/* Delivery Status Checkmarks for Own Messages */}
                      {isOwn && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-cyan-300/80">
                          <span>وصلت للجميع</span>
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                        </div>
                      )}
                    </div>

                    {/* Reactions & Quick Actions Bar */}
                    <div
                      className={`flex items-center gap-1.5 mt-1.5 flex-wrap ${
                        isOwn ? "justify-start" : "justify-end"
                      }`}
                    >
                      {/* Existing Reactions */}
                      {Object.entries(parsedReactions).map(([emoji, names]) => {
                        const reactedByMe =
                          profile && names.includes(profile.name);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition cursor-pointer ${
                              reactedByMe
                                ? "bg-indigo-500/30 border-indigo-400 text-white"
                                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/15"
                            }`}
                            title={names.join("، ")}
                          >
                            <span>{emoji}</span>
                            <span className="font-mono-num text-[11px]">
                              {names.length}
                            </span>
                          </button>
                        );
                      })}

                      {/* Hover Quick Reaction Buttons + Reply */}
                      <div className="opacity-80 sm:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity bg-[#0F1626]/90 px-2 py-0.5 rounded-full border border-white/10">
                        {QUICK_EMOJIS.slice(0, 4).map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, em)}
                            className="hover:scale-125 transition text-xs px-0.5 cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setReplyTarget(msg)}
                          className="text-slate-400 hover:text-cyan-300 pr-1 border-r border-white/10 flex items-center gap-1 text-[11px] cursor-pointer"
                          title="الرد على الرسالة"
                        >
                          <Reply className="w-3 h-3" />
                          <span>رد</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* LIVE TYPING INDICATOR BAR */}
          {typingUsers.length > 0 && (
            <div className="px-6 py-1.5 bg-[#070A12]/80 border-t border-white/5 flex items-center gap-2 text-xs text-cyan-300">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span>
                {typingUsers.map((u) => u.name).join(" و ")} يكتب الآن...
              </span>
            </div>
          )}

          {/* QUICK MEDIA STUDIO DRAWER (Images / Videos / Audio Picker) */}
          {mediaDrawer !== "none" && (
            <div className="mx-4 sm:mx-6 mb-2 p-4 rounded-2xl bg-[#0F1626]/95 backdrop-blur-2xl border border-indigo-500/30 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {mediaDrawer === "image" && (
                    <>
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>إرسال صورة (من جهازك أو من الاستوديو الفوري)</span>
                    </>
                  )}
                  {mediaDrawer === "video" && (
                    <>
                      <Video className="w-4 h-4 text-purple-400" />
                      <span>إرسال مقطع فيديو (من جهازك أو مقاطع مختارة)</span>
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setMediaDrawer("none")}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {mediaDrawer === "image" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>رفع صورة من جهازك</span>
                    </button>
                    <span className="text-xs text-slate-400">
                      أو اختر صورة جاهزة للإرسال الفوري:
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {QUICK_GALLERY_IMAGES.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPendingMedia({
                            type: "image",
                            url: img.url,
                            label: img.title,
                            meta: {
                              fileName: img.title,
                              mimeType: "image/jpeg",
                            },
                          });
                          setMediaDrawer("none");
                        }}
                        className="group relative h-24 rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400 transition cursor-pointer"
                      >
                        <img
                          src={img.url}
                          alt={img.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[10px] text-white truncate">
                          {img.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mediaDrawer === "video" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold flex items-center gap-2 shadow cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>رفع ملف فيديو من جهازك</span>
                    </button>
                    <span className="text-xs text-slate-400">
                      أو اختر مقطع فيديو فائق الدقة:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUICK_GALLERY_VIDEOS.map((vid, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPendingMedia({
                            type: "video",
                            url: vid.url,
                            label: vid.title,
                            meta: {
                              poster: vid.poster,
                              mimeType: "video/mp4",
                              duration: 15,
                            },
                          });
                          setMediaDrawer("none");
                        }}
                        className="group relative h-28 rounded-xl overflow-hidden border border-white/10 hover:border-purple-400 transition flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={vid.poster}
                          alt={vid.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1">
                          <PlayCircle className="w-8 h-8 text-white" />
                          <span className="text-xs font-bold text-white">
                            {vid.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HIDDEN NATIVE FILE INPUTS */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, "image")}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => handleFileUpload(e, "video")}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => handleFileUpload(e, "audio")}
            className="hidden"
          />

          {/* MULTIMEDIA COMPOSER DOCK */}
          <div className="p-3 sm:p-4 bg-[#0F1626]/90 backdrop-blur-2xl border-t border-white/10">
            <div className="max-w-5xl mx-auto space-y-2.5">
              {/* Reply Banner if active */}
              {replyTarget && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Reply className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-bold text-cyan-300 shrink-0">
                      الرد على {replyTarget.senderName}:
                    </span>
                    <span className="text-slate-300 truncate">
                      {replyTarget.content || "وسائط مرفقة"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Pending Media Attachment Preview */}
              {pendingMedia && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#070A12] border border-cyan-500/40">
                  <div className="flex items-center gap-3 min-w-0">
                    {pendingMedia.type === "image" && (
                      <img
                        src={pendingMedia.url}
                        alt="Preview"
                        className="w-12 h-12 rounded-lg object-cover border border-white/10"
                      />
                    )}
                    {pendingMedia.type === "video" && (
                      <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                        <Video className="w-6 h-6" />
                      </div>
                    )}
                    {pendingMedia.type === "audio" && (
                      <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                        <Volume2 className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-cyan-300 block">
                        جاهز للإرسال الفوري (
                        {pendingMedia.type === "image"
                          ? "صورة"
                          : pendingMedia.type === "video"
                          ? "فيديو"
                          : "ملف صوتي"}
                        )
                      </span>
                      <span className="text-xs text-slate-400 truncate block">
                        {pendingMedia.label}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingMedia(null)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Emoji Picker Bar */}
              {showEmojiPicker && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#070A12] border border-white/10 overflow-x-auto">
                  {[
                    "🔥",
                    "❤️",
                    "😂",
                    "✨",
                    "👏",
                    "🌹",
                    "🚀",
                    "🎙️",
                    "🎬",
                    "📸",
                    "👑",
                    "🦅",
                    "💎",
                    "🎉",
                  ].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setText((prev) => prev + em)}
                      className="text-xl hover:scale-125 transition px-1.5 cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* RECORDING MODE BAR vs STANDARD COMPOSER */}
              {isRecording ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-rose-950/90 via-[#1A1025] to-[#0F1626] border border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-mono-num text-sm font-bold text-rose-300">
                      00:{String(recordingSeconds).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-slate-200 font-medium hidden sm:inline">
                      جاري تسجيل الرسالة الصوتية المباشرة...
                    </span>
                  </div>

                  {/* Animated Live Voice Waveform */}
                  <div className="flex items-center gap-1 h-7">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((bar) => (
                      <span
                        key={bar}
                        style={{ animationDelay: `${bar * 80}ms` }}
                        className="w-1 h-full bg-rose-400 rounded-full animate-wave-bar"
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={finishAndSendVoiceNote}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>إرسال الصوتية الآن</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 sm:gap-2.5"
                >
                  {/* Multimedia Action Buttons */}
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-[#070A12] p-1.5 rounded-2xl border border-white/10 shrink-0">
                    {/* Image Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setMediaDrawer((prev) =>
                          prev === "image" ? "none" : "image"
                        )
                      }
                      className={`p-2.5 rounded-xl transition cursor-pointer ${
                        mediaDrawer === "image"
                          ? "bg-emerald-500/25 text-emerald-300"
                          : "text-slate-300 hover:bg-white/10 hover:text-emerald-300"
                      }`}
                      title="إرسال صورة"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>

                    {/* Video Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setMediaDrawer((prev) =>
                          prev === "video" ? "none" : "video"
                        )
                      }
                      className={`p-2.5 rounded-xl transition cursor-pointer ${
                        mediaDrawer === "video"
                          ? "bg-purple-500/25 text-purple-300"
                          : "text-slate-300 hover:bg-white/10 hover:text-purple-300"
                      }`}
                      title="إرسال فيديو"
                    >
                      <Video className="w-5 h-5" />
                    </button>

                    {/* Voice Recording Button */}
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="p-2.5 rounded-xl text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition cursor-pointer"
                      title="تسجيل رسالة صوتية فورية"
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    {/* Upload Audio File Button */}
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      className="hidden sm:flex p-2.5 rounded-xl text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition cursor-pointer"
                      title="رفع ملف صوتي"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>

                    {/* Emoji Button */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className={`p-2.5 rounded-xl transition cursor-pointer ${
                        showEmojiPicker
                          ? "bg-amber-500/25 text-amber-300"
                          : "text-slate-300 hover:bg-white/10 hover:text-amber-300"
                      }`}
                      title="رموز تعبيرية"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={
                      profile
                        ? `اكتب رسالتك لجميع المتواجدين يا ${profile.name}...`
                        : "سجّل اسمك أولاً لبدء الدردشة الجماعية..."
                    }
                    className="flex-1 h-13 px-4 rounded-2xl bg-[#070A12] border border-white/15 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 text-white placeholder:text-slate-500 text-sm sm:text-base outline-none transition"
                  />

                  {/* Send CTA Button */}
                  <button
                    type="submit"
                    disabled={
                      sending || (!text.trim() && !pendingMedia)
                    }
                    className="h-13 px-5 sm:px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-4px_rgba(99,102,241,0.6)] transition cursor-pointer shrink-0"
                  >
                    <span className="hidden sm:inline">إرسال</span>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
