"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration?: number;
  waveform?: number[];
  isOwn?: boolean;
}

export function VoiceNotePlayer({
  audioUrl,
  duration = 4,
  waveform = [],
  isOwn = false,
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 4);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const bars =
    waveform && waveform.length > 0
      ? waveform
      : [
          0.3, 0.55, 0.72, 0.4, 0.85, 0.95, 0.6, 0.45, 0.78, 0.9, 0.5, 0.35,
          0.68, 0.88, 0.74, 0.42, 0.62, 0.92, 0.8, 0.52, 0.38, 0.7, 0.84, 0.64,
          0.48, 0.76, 0.9, 0.58, 0.4, 0.66, 0.5, 0.32,
        ];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        audio.playbackRate = playbackRate;
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio playback failed:", err);
      }
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const ratio = index / bars.length;
    const target = ratio * (totalDuration || 4);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const cycleRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressRatio =
    totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;

  const formatSec = (sec: number) => {
    const s = Math.max(0, Math.round(sec));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-3 border transition-all min-w-[260px] sm:min-w-[310px] ${
        isOwn
          ? "bg-black/25 border-white/15"
          : "bg-[#090D18]/80 border-white/10"
      }`}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل التسجيل الصوتي"}
        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-lg ${
          isOwn
            ? "bg-white text-indigo-700 hover:bg-indigo-50"
            : "bg-gradient-to-tr from-indigo-500 to-cyan-400 text-white hover:opacity-95"
        }`}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Waveform Bars */}
        <div
          className="flex items-center gap-[3px] h-8 cursor-pointer select-none"
          dir="ltr"
        >
          {bars.map((peak, idx) => {
            const barRatio = idx / bars.length;
            const isPlayed = barRatio <= progressRatio;
            const heightPct = Math.max(20, Math.round(peak * 100));
            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{ height: `${heightPct}%` }}
                className={`flex-1 rounded-full transition-colors duration-150 min-w-[3px] ${
                  isPlayed
                    ? isOwn
                      ? "bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.7)]"
                      : "bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.7)]"
                    : isOwn
                    ? "bg-white/30 hover:bg-white/50"
                    : "bg-slate-600/60 hover:bg-slate-400/70"
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-300/90">
          <span className="font-mono-num tracking-wider">
            {isPlaying ? formatSec(currentTime) : formatSec(totalDuration)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-300/90">
            <Volume2 className="w-3 h-3" />
            بصمة صوتية رقمية
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={cycleRate}
        className="px-2 py-1 rounded-lg text-[11px] font-mono-num font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 shrink-0 transition"
        title="سرعة التشغيل"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
