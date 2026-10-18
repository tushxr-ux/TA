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

const STATUS_ICON = { sent: "✓", delivered: "✓✓", read: "✓✓" } as const;

export default function ChatBubble({ msg, isMine, onLongPress }: Props) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`${styles.wrap} ${isMine ? styles.mine : styles.theirs}`}
      onContextMenu={e => { e.preventDefault(); onLongPress?.(msg); }}
    >
      <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
        {msg.type === "image" && msg.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={msg.mediaUrl} alt="Sent image" className={styles.mediaImg} />
        )}
        {msg.type === "audio" && msg.mediaUrl && (
          <audio controls src={msg.mediaUrl} className={styles.audio} />
        )}
        {msg.body && <p className={styles.text}>{msg.body}</p>}

        <div className={styles.meta}>
          <span className={styles.time}>{time}</span>
          {isMine && msg.status && (
            <span className={`${styles.status} ${msg.status === "read" ? styles.statusRead : ""}`}>
              {STATUS_ICON[msg.status]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
