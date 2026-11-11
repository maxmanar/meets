"use client";

import React, { useRef, useState } from "react";
import { AVATAR_PRESETS } from "@/lib/chat-constants";
import { Sparkles, Camera, ShieldCheck, Radio, UserCheck, X } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  canClose: boolean;
  initialName?: string;
  initialAvatar?: string;
  initialColor?: string;
  initialBio?: string;
  initialBadge?: string;
  onlineCount: number;
  onClose?: () => void;
  onSubmit: (profile: {
    name: string;
    avatar: string;
    color: string;
    bio: string;
    roleBadge: string;
  }) => Promise<void>;
}

const BADGE_OPTIONS = [
  "عضو نشط",
  "مبدع صوتي 🎙️",
  "صانع محتوى مرئي 🎬",
  "مطور ويب 💻",
  "ضيف مميز ✨",
];

export function ProfileModal({
  isOpen,
  canClose,
  initialName = "",
  initialAvatar = "🦅",
  initialColor = "from-indigo-500 to-cyan-400",
  initialBio = "متصل الآن في صالون تواصل المباشر",
  initialBadge = "عضو نشط",
  onlineCount,
  onClose,
  onSubmit,
}: ProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [color, setColor] = useState(initialColor);
  const [bio, setBio] = useState(initialBio);
  const [roleBadge, setRoleBadge] = useState(initialBadge);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("الرجاء كتابة اسمك الظاهر للدخول إلى صالون الدردشة");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        avatar,
        color,
        bio: bio.trim() || "متصل الآن في صالون تواصل المباشر",
        roleBadge,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isCustomImage = avatar.startsWith("data:image") || avatar.startsWith("http");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05070E]/85 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0F1626]/95 border border-white/15 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85),0_0_40px_rgba(99,102,241,0.18)] overflow-hidden">
        {/* Top Glowing Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400" />

        {canClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 left-5 w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 online-pulse" />
                <span>{onlineCount} متصلين الآن في البث الحي</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white tracking-tight">
                {canClose ? "تحديث بطاقة الهوية" : "أنشئ ملفك الشخصي للدردشة"}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                سجّل اسمك واختر مظهرك للانضمام فوراً إلى الدردشة الجماعية بالصوت والصورة والفيديو
              </p>
            </div>
          </div>

          {/* Live Identity Card Preview */}
          <div className="p-4 rounded-2xl bg-[#070A12]/90 border border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${color} p-[2px] shadow-lg`}
                >
                  <div className="w-full h-full rounded-[14px] bg-[#0F1626] flex items-center justify-center text-2xl overflow-hidden">
                    {isCustomImage ? (
                      <img
                        src={avatar}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{avatar}</span>
                    )}
                  </div>
                </div>
                <span
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#070A12] online-pulse"
                  title="متصل الآن"
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-base truncate">
                    {name.trim() || "اسمك يظهر هنا..."}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {roleBadge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {bio.trim() || "متصل الآن في صالون تواصل المباشر"}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end text-[11px] text-emerald-400 shrink-0">
              <span className="flex items-center gap-1 font-medium">
                <Radio className="w-3.5 h-3.5" />
                ONLINE
              </span>
              <span className="text-slate-500">رصد لحظي</span>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              الاسم المستعار / الاسم الشخصي <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="مثال: عبدالمجيد، نواف، ريما..."
              autoFocus
              maxLength={36}
              className="w-full px-4 py-3.5 rounded-xl bg-[#070A12] border border-white/15 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white placeholder:text-slate-500 text-base outline-none transition"
            />
            {error && (
              <p className="text-xs text-rose-400 mt-1.5 font-medium">{error}</p>
            )}
          </div>

          {/* Avatar Picker + Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                اختر الرمز الشخصي أو ارفع صورتك
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition"
              >
                <Camera className="w-3.5 h-3.5" />
                رفع صورة من جهازك
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomAvatarUpload}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const selected = avatar === preset.emoji;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAvatar(preset.emoji);
                      setColor(preset.color);
                    }}
                    className={`h-11 rounded-xl flex items-center justify-center text-xl border transition-all ${
                      selected
                        ? "bg-indigo-600/25 border-indigo-400 scale-105 shadow-[0_0_15px_rgba(99,102,241,0.35)]"
                        : "bg-[#070A12]/80 border-white/10 hover:border-white/25"
                    }`}
                    title={preset.label}
                  >
                    {preset.emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Badge & Bio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اللقب / الشارة
              </label>
              <select
                value={roleBadge}
                onChange={(e) => setRoleBadge(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070A12] border border-white/15 text-sm text-white outline-none focus:border-indigo-500"
              >
                {BADGE_OPTIONS.map((b) => (
                  <option key={b} value={b} className="bg-[#0F1626] text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                نبذة / حالة قصيرة
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={70}
                placeholder="متصل الآن للدردشة..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070A12] border border-white/15 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-base shadow-[0_10px_30px_-5px_rgba(99,102,241,0.55)] hover:shadow-[0_15px_35px_-5px_rgba(6,182,212,0.6)] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            <UserCheck className="w-5 h-5" />
            <span>
              {submitting
                ? "جاري تفعيل الاتصال الفوري..."
                : canClose
                ? "حفظ التغييرات والعودة للدردشة"
                : "دخول صالون الدردشة المباشر الآن"}
            </span>
            <Sparkles className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              نظام رصد الحضور الذكي مفعّل: يظهر اتصالك فوراً للجميع ويتحول تلقائياً إلى غير متصل عند مغادرة الصفحة
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
