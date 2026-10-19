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
  reactions?: Record<string, string>; // userId → emoji
  editedAt?: string | null;
}

export interface BubbleActions {
  onDelete: (msg: Message, scope: "me" | "all") => void;
  onReply: (msg: Message) => void;
  onReact: (msg: Message, emoji: string) => void;
  onMediaClick: (url: string, name: string, type: "image" | "video") => void;
  onEdit?: (msg: Message) => void;
}

const MAX_REPLAYS = 2;
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

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
  const [confirmDeleteScope, setConfirmDeleteScope] = useState<"me" | "all" | null>(null);
  const [copied, setCopied] = useState(false);

  // Swipe-left-to-reply & gesture state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwiping = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLongPressedRef = useRef(false);

  const ext = isVideo ? ".mp4" : ".jpg";
  const baseName = `ta-${msg.type}-${msg.id.slice(0, 8)}${ext}`;

  // ── Pointer down: initiate long-press & swipe tracking ─────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    isSwiping.current = false;
    hasLongPressedRef.current = false;

    // Long press to open message action sheet (edit, delete, react)
    longPressTimer.current = setTimeout(() => {
      if (!isSwiping.current) {
        hasLongPressedRef.current = true;
        setShowCtx(true);
        try { navigator.vibrate?.(35); } catch {}
      }
    }, 450);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!touchStartPos.current) return;
    const dx = e.clientX - touchStartPos.current.x;
    const dy = e.clientY - touchStartPos.current.y;

    if (!isSwiping.current) {
      // If moving vertically, cancel long-press
      if (Math.abs(dy) > Math.abs(dx)) {
        if (Math.abs(dy) > 10 && longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }
        return;
      }
      // Swipe left detected
      if (dx < -12 && Math.abs(dx) > Math.abs(dy)) {
        isSwiping.current = true;
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
    }

    if (isSwiping.current) {
      const clamped = Math.max(-68, Math.min(0, dx));
      setSwipeOffset(clamped);
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (isSwiping.current && swipeOffset <= -42) {
      actions?.onReply?.(msg);
      try { navigator.vibrate?.(25); } catch {}
    }

    isSwiping.current = false;
    touchStartPos.current = null;
    setSwipeOffset(0);
  }, [actions, msg, swipeOffset]);

  const closeAll = () => {
    setShowCtx(false);
    setConfirmDeleteScope(null);
    setCopied(false);
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

  // Aggregate reactions: emoji → count
  const reactionCounts: Record<string, number> = {};
  if (msg.reactions && typeof msg.reactions === "object") {
    Object.values(msg.reactions).forEach(e => {
      if (e) reactionCounts[e] = (reactionCounts[e] || 0) + 1;
    });
  }

  return (
    <div
      className={`${styles.wrap} ${isMine ? styles.mine : styles.theirs}`}
      onContextMenu={e => { e.preventDefault(); setShowCtx(true); }}
    >
      {/* ── Fixed Action Modal / Bottom Sheet ─────────────────────────────────── */}
      {showCtx && (
        <div
          className={styles.actionOverlay}
          onClick={e => {
            e.stopPropagation();
            closeAll();
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div
            className={styles.actionCard}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            {confirmDeleteScope ? (
              <div className={styles.confirmBox}>
                <div className={styles.confirmIcon}>🗑️</div>
                <h4 className={styles.confirmTitle}>
                  {confirmDeleteScope === "all" ? "Delete for everyone?" : "Delete for me?"}
                </h4>
                <p className={styles.confirmDesc}>
                  {confirmDeleteScope === "all"
                    ? "This message will be deleted for both you and your partner."
                    : "This message will be removed from your chat history."}
                </p>
                <div className={styles.confirmBtns}>
                  <button
                    type="button"
                    className={styles.confirmCancelBtn}
                    onClick={() => setConfirmDeleteScope(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.confirmDeleteBtn}
                    onClick={() => {
                      actions?.onDelete?.(msg, confirmDeleteScope);
                      closeAll();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Quick Emoji Reactions */}
                <div className={styles.actionEmojiRow}>
                  {QUICK_EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      className={styles.actionEmojiBtn}
                      title={`React ${e}`}
                      onClick={() => {
                        actions?.onReact?.(msg, e);
                        closeAll();
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>

                {/* 2. Message Snippet */}
                <div className={styles.actionSnippet}>
                  <span className={styles.snippetSender}>{isMine ? "You" : "Partner"}:</span>{" "}
                  <span className={styles.snippetText}>
                    {msg.type === "image"
                      ? "📷 Photo"
                      : msg.type === "video"
                      ? "🎥 Video"
                      : msg.type === "audio"
                      ? "🎵 Audio message"
                      : msg.body?.slice(0, 65) || ""}
                  </span>
                </div>

                {/* 3. Action Items */}
                <div className={styles.actionList}>
                  {/* Edit: Available for sender's own text messages */}
                  {isMine && !isImage && !isVideo && !isAudio && actions?.onEdit && (
                    <button
                      type="button"
                      className={styles.actionItem}
                      onClick={() => {
                        actions?.onEdit?.(msg);
                        closeAll();
                      }}
                    >
                      <span className={styles.actionIcon}>✏️</span>
                      <span>Edit message</span>
                    </button>
                  )}

                  {/* Reply */}
                  <button
                    type="button"
                    className={styles.actionItem}
                    onClick={() => {
                      actions?.onReply?.(msg);
                      closeAll();
                    }}
                  >
                    <span className={styles.actionIcon}>↩️</span>
                    <span>Reply</span>
                  </button>

                  {/* Copy text */}
                  {!isImage && !isVideo && !isAudio && msg.body && (
                    <button
                      type="button"
                      className={styles.actionItem}
                      onClick={() => {
                        try {
                          navigator.clipboard?.writeText(msg.body || "");
                          setCopied(true);
                          setTimeout(() => {
                            closeAll();
                          }, 500);
                        } catch {
                          closeAll();
                        }
                      }}
                    >
                      <span className={styles.actionIcon}>📋</span>
                      <span>{copied ? "Copied! ✓" : "Copy text"}</span>
                    </button>
                  )}

                  {/* Delete for me */}
                  <button
                    type="button"
                    className={styles.actionItem}
                    onClick={() => setConfirmDeleteScope("me")}
                  >
                    <span className={styles.actionIcon}>🗑️</span>
                    <span>Delete for me</span>
                  </button>

                  {/* Delete for everyone */}
                  {isMine && (
                    <button
                      type="button"
                      className={`${styles.actionItem} ${styles.actionDanger}`}
                      onClick={() => setConfirmDeleteScope("all")}
                    >
                      <span className={styles.actionIcon}>❌</span>
                      <span>Delete for everyone</span>
                    </button>
                  )}
                </div>

                {/* Dismiss */}
                <button
                  type="button"
                  className={styles.actionDismissBtn}
                  onClick={closeAll}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bubble Column (Supports Swipe-to-Reply & Bottom Reactions) ──────── */}
      <div
        className={`${styles.bubbleCol} ${isMine ? styles.colMine : styles.colTheirs}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}
          style={{
            transform: swipeOffset < 0 ? `translateX(${swipeOffset}px)` : undefined,
            transition: isSwiping.current ? "none" : "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)",
          }}
          onClick={() => {
            if (hasLongPressedRef.current) {
              hasLongPressedRef.current = false;
              return;
            }
            if (isSwiping.current) return;
            // For text messages, tapping or clicking the message bubble opens the options sheet
            if (!isImage && !isVideo && !isAudio) {
              setShowCtx(true);
            }
          }}
        >
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
            {msg.editedAt && <span className={styles.editedTag}>edited</span>}
            {isViewOnce && <span className={styles.viewOnceMini} title="View once">🔥</span>}
            <span className={styles.time}>{time}</span>
            {isMine && (
              <span className={styles.status}>
                {(!msg.status || msg.status === "sent") && <IconCheck size={14} color="#8696a0" />}
                {msg.status === "delivered" && <IconCheckDouble size={16} isRead={false} />}
                {msg.status === "read" && <IconCheckDouble size={16} isRead={true} />}
              </span>
            )}
          </div>
        </div>

        {/* ── Swipe Reply Indicator (reveals when dragging left) ────────────── */}
        {swipeOffset < 0 && (
          <div
            className={styles.swipeReplyIcon}
            style={{
              opacity: Math.min(1, Math.abs(swipeOffset) / 38),
              transform: `translateY(-50%) scale(${Math.min(1.15, 0.7 + (Math.abs(swipeOffset) / 45) * 0.45)})`,
              background: swipeOffset <= -42 ? "#00a884" : "rgba(255,255,255,0.2)",
              color: "#ffffff",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          </div>
        )}

        {/* ── Reaction Chips ──────────────────────────────────────────────── */}
        {Object.keys(reactionCounts).length > 0 && (
          <div
            className={`${styles.reactionRow} ${isMine ? styles.reactionMine : styles.reactionTheirs}`}
            onPointerDown={e => e.stopPropagation()}
          >
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                className={styles.reactionChip}
                onClick={e => {
                  e.stopPropagation();
                  actions?.onReact?.(msg, emoji);
                }}
              >
                <span>{emoji}</span>
                {count > 1 && <span className={styles.reactionCount}>{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
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
