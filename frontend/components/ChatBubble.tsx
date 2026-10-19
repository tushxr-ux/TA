"use client";
import React, { useState } from "react";
import { IconCheck, IconCheckDouble, IconDownload } from "./Icons";
import styles from "./ChatBubble.module.css";

export interface Message {
  id: string;
  senderId: string;
  type: string;
  body?: string;
  mediaUrl?: string;
  replyTo?: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
  viewOnce?: boolean;
  viewed?: boolean;
}

interface Props {
  msg: Message;
  isMine: boolean;
  onLongPress?: (msg: Message) => void;
  /** Called when user taps image/video to fullscreen */
  onMediaClick?: (url: string, downloadName: string, type: "image" | "video") => void;
}

const MAX_REPLAYS = 2;

export default function ChatBubble({ msg, isMine, onLongPress, onMediaClick }: Props) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const mediaUrl = msg.mediaUrl || msg.body || "";
  const isImage = msg.type === "image";
  const isVideo = msg.type === "video";
  const isAudio = msg.type === "audio";

  const isViewOnce = Boolean(msg.viewOnce);

  // replaysLeft: receiver gets MAX_REPLAYS views; sender gets unlimited (999)
  const [replaysLeft, setReplaysLeft] = useState(isMine ? 999 : MAX_REPLAYS);
  const [revealed, setRevealed] = useState(isMine); // sender always sees immediately

  const ext = isVideo ? ".mp4" : ".jpg";
  const baseName = `ta-${msg.type}-${msg.id.slice(0, 8)}${ext}`;

  const handleMediaTap = () => {
    if (!mediaUrl) return;

    if (isViewOnce && !revealed) {
      // First tap: reveal
      if (replaysLeft > 0) {
        setRevealed(true);
        setReplaysLeft(n => n - 1);
      }
      return;
    }

    if (isViewOnce && replaysLeft <= 0) return; // burned

    // Open lightbox
    onMediaClick?.(mediaUrl, baseName, isVideo ? "video" : "image");

    // Count replay on lightbox open too for view-once
    if (isViewOnce && !isMine && replaysLeft > 0) {
      setReplaysLeft(n => Math.max(0, n - 1));
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = baseName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const masked = isViewOnce && !isMine && !revealed;
  const burned = isViewOnce && !isMine && revealed && replaysLeft <= 0;
  const canDownload = isMine || (!isViewOnce) || (revealed && replaysLeft > 0);

  return (
    <div
      className={`${styles.wrap} ${isMine ? styles.mine : styles.theirs}`}
      onContextMenu={e => { e.preventDefault(); onLongPress?.(msg); }}
    >
      <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>

        {/* ── Image ─────────────────────────────────────────────────────── */}
        {isImage && mediaUrl && (
          <div className={styles.mediaWrap}>
            <div
              className={`${styles.mediaImgWrap} ${masked ? styles.viewOnceMask : ""}`}
              onClick={handleMediaTap}
              title={masked ? "Tap to view (view once)" : burned ? "Viewed" : "Tap to zoom"}
              style={{ cursor: burned ? "default" : "zoom-in" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt="Sent image" className={styles.mediaImg} loading="lazy" draggable={false} />
              {(masked || burned) && (
                <ViewOnceBadge burned={burned} replaysLeft={replaysLeft} isVideo={false} />
              )}
            </div>
            {canDownload && (
              <button className={styles.downloadBtn} title="Download" onClick={handleDownload}>
                <IconDownload size={14} color="#e9edef" />
              </button>
            )}
            {isViewOnce && !isMine && revealed && !burned && (
              <div className={styles.replaysChip}>🔥 {replaysLeft} view{replaysLeft !== 1 ? "s" : ""} left</div>
            )}
          </div>
        )}

        {/* ── Video ─────────────────────────────────────────────────────── */}
        {isVideo && mediaUrl && (
          <div className={styles.mediaWrap}>
            <div
              className={`${styles.mediaImgWrap} ${masked ? styles.viewOnceMask : ""}`}
              onClick={handleMediaTap}
              title={masked ? "Tap to view (view once)" : burned ? "Viewed" : "Tap to play fullscreen"}
              style={{ cursor: burned ? "default" : "pointer" }}
            >
              <video
                src={mediaUrl}
                className={styles.mediaImg}
                preload="metadata"
                muted
                playsInline
                style={{ pointerEvents: "none" }}
              />
              {/* play overlay icon */}
              {!masked && !burned && (
                <div className={styles.videoPlayOverlay}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="18" fill="rgba(0,0,0,0.55)" />
                    <polygon points="14,11 28,18 14,25" fill="white" />
                  </svg>
                </div>
              )}
              {(masked || burned) && (
                <ViewOnceBadge burned={burned} replaysLeft={replaysLeft} isVideo={true} />
              )}
            </div>
            {canDownload && (
              <button className={styles.downloadBtn} title="Download video" onClick={handleDownload}>
                <IconDownload size={14} color="#e9edef" />
              </button>
            )}
            {isViewOnce && !isMine && revealed && !burned && (
              <div className={styles.replaysChip}>🔥 {replaysLeft} view{replaysLeft !== 1 ? "s" : ""} left</div>
            )}
          </div>
        )}

        {/* ── Audio ─────────────────────────────────────────────────────── */}
        {isAudio && mediaUrl && (
          <div className={styles.audioWrap}>
            <audio controls src={mediaUrl} className={styles.audio} />
          </div>
        )}

        {/* ── Text ──────────────────────────────────────────────────────── */}
        {!isImage && !isVideo && !isAudio && msg.body && (
          <p className={styles.text}>{msg.body}</p>
        )}

        <div className={styles.meta}>
          {isViewOnce && <span className={styles.viewOnceMini} title="View once">🔥</span>}
          <span className={styles.time}>{time}</span>
          {isMine && (
            <span className={styles.status}>
              {msg.status === "sent" ? (
                <IconCheck size={14} color="#8696a0" />
              ) : (
                <IconCheckDouble size={16} isRead={msg.status === "read"} />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewOnceBadge({ burned, replaysLeft, isVideo }: { burned: boolean; replaysLeft: number; isVideo: boolean }) {
  if (burned) {
    return (
      <div className={styles.viewOnceBadge} style={{ background: "rgba(0,0,0,0.7)" }}>
        <span style={{ fontSize: "1.5rem" }}>🔥</span>
        <span>Opened</span>
      </div>
    );
  }
  return (
    <div className={styles.viewOnceBadge}>
      {isVideo ? (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <polygon points="5 3 19 12 5 21 5 3" fill="white" />
        </svg>
      ) : (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      <span>View once · {replaysLeft}×</span>
    </div>
  );
}
