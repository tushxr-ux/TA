import React from "react";
import { IconCheck, IconCheckDouble } from "./Icons";
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
}

interface Props {
  msg: Message;
  isMine: boolean;
  onLongPress?: (msg: Message) => void;
}

export default function ChatBubble({ msg, isMine, onLongPress }: Props) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`${styles.wrap} ${isMine ? styles.mine : styles.theirs}`}
      onContextMenu={e => { e.preventDefault(); onLongPress?.(msg); }}
    >
      <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
        {msg.type === "image" && (msg.mediaUrl || msg.body) && (
          <div className={styles.mediaWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.mediaUrl || msg.body}
              alt="Sent image"
              className={styles.mediaImg}
              loading="lazy"
            />
          </div>
        )}
        {msg.type === "audio" && (msg.mediaUrl || msg.body) && (
          <div className={styles.audioWrap}>
            <audio controls src={msg.mediaUrl || msg.body} className={styles.audio} />
          </div>
        )}
        {msg.type !== "image" && msg.type !== "audio" && msg.body && (
          <p className={styles.text}>{msg.body}</p>
        )}

        <div className={styles.meta}>
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
