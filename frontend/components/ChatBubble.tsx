"use client";
import React, { useState, useRef, useCallback } from "react";
import { IconCheck, IconCheckDouble, IconDownload } from "./Icons";
import styles from "./ChatBubble.module.css";

export interface Message {
  id: string;
  senderId: string;
  type: string;
  body?: string;
  mediaUrl?: string;
  replyTo?: string;
  replyBody?: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
  viewOnce?: boolean;
  viewed?: boolean;
  reactions?: Record<string, string>; // emoji → userId
}

export interface BubbleActions {
  onDelete: (msg: Message, scope: "me" | "all") => void;
  onReply: (msg: Message) => void;
  onReact: (msg: Message, emoji: string) => void;
  onMediaClick: (url: string, name: string, type: "image" | "video") => void;
}

const MAX_REPLAYS = 2;
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "👍"];

interface Props {
  msg: Message;
  isMine: boolean;
  actions: BubbleActions;
}

export default function ChatBubble({ msg, isMine, actions }: Props) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const mediaUrl = msg.mediaUrl || msg.body || "";
  const isImage = msg.type === "image";
  const isVideo = msg.type === "video";
  const isAudio = msg.type === "audio";
  const isViewOnce = Boolean(msg.viewOnce);

  const [replaysLeft, setReplaysLeft] = useState(isMine ? 999 : MAX_REPLAYS);
  const [revealed, setRevealed] = useState(isMine);
  const [showCtx, setShowCtx] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [confirmDeleteScope, setConfirmDeleteScope] = useState<"me" | "all" | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const ext = isVideo ? ".mp4" : ".jpg";
  const baseName = `ta-${msg.type}-${msg.id.slice(0, 8)}${ext}`;

  // ── Long press with scroll cancellation ────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      setShowCtx(true);
    }, 550);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (touchStartPos.current) {
      const dx = Math.abs(e.clientX - touchStartPos.current.x);
      const dy = Math.abs(e.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const closeAll = () => {
    setShowCtx(false);
    setShowReactions(false);
    setConfirmDeleteScope(null);
  };

  // ── Media tap ──────────────────────────────────────────────────────────────
  const handleMediaTap = () => {
    if (!mediaUrl) return;
    if (isViewOnce && !revealed) {
      if (replaysLeft > 0) { setRevealed(true); setReplaysLeft(n => n - 1); }
      return;
    }
    if (isViewOnce && replaysLeft <= 0) return;
    actions?.onMediaClick?.(mediaUrl, baseName, isVideo ? "video" : "image");
    if (isViewOnce && !isMine && replaysLeft > 0) setReplaysLeft(n => Math.max(0, n - 1));
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = mediaUrl; a.download = baseName; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const masked = isViewOnce && !isMine && !revealed;
  const burned = isViewOnce && !isMine && revealed && replaysLeft <= 0;
  const canDownload = isMine || !isViewOnce || (revealed && replaysLeft > 0);

  // Aggregate reactions
  const reactionCounts: Record<string, number> = {};
  if (msg.reactions) {
    Object.values(msg.reactions).forEach(e => { reactionCounts[e] = (reactionCounts[e] || 0) + 1; });
  }

  return (
    <div
      className={`${styles.wrap} ${isMine ? styles.mine : styles.theirs}`}
      onContextMenu={e => { e.preventDefault(); setShowCtx(true); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* ── Context menu with quick emoji bar ──────────────────────────────── */}
      {showCtx && (
        <div className={`${styles.ctxMenu} ${isMine ? styles.ctxMine : styles.ctxTheirs}`}>
          <div className={styles.ctxEmojiRow}>
            {QUICK_EMOJIS.map(e => (
              <button
                key={e}
                className={styles.emojiBtn}
                title={`React with ${e}`}
                onClick={() => { actions?.onReact?.(msg, e); closeAll(); }}
              >
                {e}
              </button>
            ))}
          </div>
          <button className={styles.ctxItem} onClick={() => { actions?.onReply?.(msg); closeAll(); }}>
            ↩ Reply
          </button>
          {isMine && (
            <>
              <button className={styles.ctxItem} onClick={() => { setConfirmDeleteScope("me"); setShowCtx(false); }}>
                🗑 Delete for me
              </button>
              <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => { setConfirmDeleteScope("all"); setShowCtx(false); }}>
                ❌ Delete for everyone
              </button>
            </>
          )}
          {!isMine && (
            <button className={styles.ctxItem} onClick={() => { setConfirmDeleteScope("me"); setShowCtx(false); }}>
              🗑 Delete for me
            </button>
          )}
          <button className={styles.ctxCancel} onClick={closeAll}>Cancel</button>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      {confirmDeleteScope && (
        <div className={`${styles.ctxMenu} ${isMine ? styles.ctxMine : styles.ctxTheirs}`} style={{ padding: "14px", minWidth: "220px", textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#eeeef4", lineHeight: 1.4 }}>
            {confirmDeleteScope === "all" ? "Delete for everyone?" : "Delete this message?"}
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              className={styles.ctxCancel}
              style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "7px 14px", borderRadius: "8px" }}
              onClick={() => setConfirmDeleteScope(null)}
            >
              Cancel
            </button>
            <button
              className={`${styles.ctxItem} ${styles.ctxDanger}`}
              style={{ width: "auto", padding: "7px 16px", borderRadius: "8px", background: "rgba(248,113,113,0.18)" }}
              onClick={() => {
                actions?.onDelete?.(msg, confirmDeleteScope);
                setConfirmDeleteScope(null);
                closeAll();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div
        className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}
        onClick={() => { if (showCtx || showReactions) closeAll(); }}
      >
        {/* Subtle hover options trigger */}
        <button
          type="button"
          className={styles.bubbleMenuBtn}
          title="Message actions"
          aria-label="Message actions"
          onClick={e => {
            e.stopPropagation();
            setShowCtx(v => !v);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* ── Reply preview ───────────────────────────────────────────────── */}
        {msg.replyBody && (
          <div className={styles.replyPreview}>
            <span className={styles.replyLine} />
            <span className={styles.replyText}>{msg.replyBody.slice(0, 80)}{msg.replyBody.length > 80 ? "…" : ""}</span>
          </div>
        )}

        {/* ── Image ───────────────────────────────────────────────────────── */}
        {isImage && mediaUrl && (
          <div className={styles.mediaWrap}>
            <div
              className={`${styles.mediaImgWrap} ${masked ? styles.viewOnceMask : ""}`}
              onClick={handleMediaTap}
              style={{ cursor: burned ? "default" : "zoom-in" }}
              title={masked ? "Tap to view (view once)" : burned ? "Viewed" : "Tap to zoom"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt="Sent image" className={styles.mediaImg} loading="lazy" draggable={false} />
              {(masked || burned) && <ViewOnceBadge burned={burned} replaysLeft={replaysLeft} isVideo={false} />}
            </div>
            {canDownload && <button className={styles.downloadBtn} title="Download" onClick={handleDownload}><IconDownload size={14} color="#eeeef4" /></button>}
            {isViewOnce && !isMine && revealed && !burned && <div className={styles.replaysChip}>🔥 {replaysLeft}×</div>}
          </div>
        )}

        {/* ── Video ───────────────────────────────────────────────────────── */}
        {isVideo && mediaUrl && (
          <div className={styles.mediaWrap}>
            <div
              className={`${styles.mediaImgWrap} ${masked ? styles.viewOnceMask : ""}`}
              onClick={handleMediaTap}
              style={{ cursor: burned ? "default" : "pointer" }}
              title={masked ? "Tap to view (view once)" : burned ? "Viewed" : "Tap to play"}
            >
              <video src={mediaUrl} className={styles.mediaImg} preload="metadata" muted playsInline style={{ pointerEvents: "none" }} />
              {!masked && !burned && (
                <div className={styles.videoPlayOverlay}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="18" fill="rgba(0,0,0,0.55)" />
                    <polygon points="14,11 28,18 14,25" fill="white" />
                  </svg>
                </div>
              )}
              {(masked || burned) && <ViewOnceBadge burned={burned} replaysLeft={replaysLeft} isVideo={true} />}
            </div>
            {canDownload && <button className={styles.downloadBtn} title="Download" onClick={handleDownload}><IconDownload size={14} color="#eeeef4" /></button>}
            {isViewOnce && !isMine && revealed && !burned && <div className={styles.replaysChip}>🔥 {replaysLeft}×</div>}
          </div>
        )}

        {/* ── Audio ───────────────────────────────────────────────────────── */}
        {isAudio && mediaUrl && (
          <div className={styles.audioWrap}>
            <audio controls src={mediaUrl} className={styles.audio} />
          </div>
        )}

        {/* ── Text ────────────────────────────────────────────────────────── */}
        {!isImage && !isVideo && !isAudio && msg.body && (
          <p className={styles.text}>{msg.body}</p>
        )}

        {/* ── Meta ────────────────────────────────────────────────────────── */}
        <div className={styles.meta}>
          {isViewOnce && <span className={styles.viewOnceMini} title="View once">🔥</span>}
          <span className={styles.time}>{time}</span>
          {isMine && (
            <span className={styles.status}>
              {msg.status === "sent" ? <IconCheck size={14} color="#9191a8" /> : <IconCheckDouble size={16} isRead={msg.status === "read"} />}
            </span>
          )}
        </div>
      </div>

      {/* ── Reaction chips ────────────────────────────────────────────────── */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className={`${styles.reactionRow} ${isMine ? styles.reactionMine : ""}`}>
          {Object.entries(reactionCounts).map(([e, n]) => (
            <span key={e} className={styles.reactionChip} onClick={() => actions.onReact(msg, e)}>{e}{n > 1 ? ` ${n}` : ""}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewOnceBadge({ burned, replaysLeft, isVideo }: { burned: boolean; replaysLeft: number; isVideo: boolean }) {
  if (burned) return (
    <div className={styles.viewOnceBadge} style={{ background: "rgba(0,0,0,0.7)" }}>
      <span style={{ fontSize: "1.5rem" }}>🔥</span><span>Opened</span>
    </div>
  );
  return (
    <div className={styles.viewOnceBadge}>
      {isVideo
        ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" fill="white" /></svg>
        : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      }
      <span>View once · {replaysLeft}×</span>
    </div>
  );
}
