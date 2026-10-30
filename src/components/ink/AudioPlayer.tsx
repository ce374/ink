"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { api } from "@/lib/api";

export function AudioPlayer({
  mediaId,
  name,
  mini,
}: {
  mediaId: string;
  name?: string;
  mini?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onDur = () => setDur(a.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setCur(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onDur);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onDur);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = Math.max(0, Math.min(dur, ratio * dur));
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (mini) {
    return (
      <div className="ap-mini" onClick={(e) => e.stopPropagation()}>
        <button className="ap-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={11} /> : <Play size={11} />}
        </button>
        <span className="ap-time">
          {fmt(cur)} / {fmt(dur)}
        </span>
        <audio
          ref={audioRef}
          src={api.mediaUrl(mediaId)}
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div className="audio-player" onClick={(e) => e.stopPropagation()}>
      <div className="ap-row">
        <button className="ap-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div className="ap-info">
          <div className="ap-name">{name || "Audio"}</div>
          <div className="ap-time">
            {fmt(cur)} / {fmt(dur)}
          </div>
        </div>
      </div>
      <div
        className="ap-seek"
        style={{
          position: "relative",
          background: "var(--line-2)",
          height: 4,
          borderRadius: 2,
          cursor: "pointer",
        }}
        onClick={seek}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${dur ? (cur / dur) * 100 : 0}%`,
            background: "var(--ink)",
            borderRadius: 2,
          }}
        />
      </div>
      <audio ref={audioRef} src={api.mediaUrl(mediaId)} preload="metadata" />
    </div>
  );
}
