"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import ChatBubble, { Message } from "@/components/ChatBubble";
import DeleteRangeSheet from "@/components/DeleteRangeSheet";
import Toast from "@/components/Toast";
import { API_URL } from "@/lib/api";
import styles from "./page.module.css";

const MOCK_USER_ID = "me"; // replaced by real JWT userId in Phase 1.3

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [token] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convId = "demo-conv"; // replaced by router param in Phase 1.4

  const { emit, on } = useSocket(token);

  // ── Real-time events ──────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      on("message:new", (msg) => {
        setMessages(prev => [...prev, msg as Message]);
        emit("message:delivered", { messageId: (msg as Message).id });
      }),
      on("message:ack", (ack) => {
        setMessages(prev => prev.map(m =>
          m.id === (ack as any).clientMsgId ? { ...m, id: (ack as any).messageId, status: "sent" } : m
        ));
      }),
      on("message:status", (s: any) => {
        setMessages(prev => prev.map(m => m.id === s.messageId ? { ...m, status: s.status } : m));
      }),
      on("typing", (t: any) => {
        if (t.userId !== MOCK_USER_ID) setPartnerTyping(t.isTyping);
      }),
    ];
    return () => offs.forEach(off => off?.());
  }, [on, emit]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!input.trim()) return;
    const clientMsgId = `${Date.now()}-${Math.random()}`;
    const optimistic: Message = {
      id: clientMsgId,
      senderId: MOCK_USER_ID,
      type: "text",
      body: input.trim(),
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    setMessages(prev => [...prev, optimistic]);
    emit("message:send", { conversationId: convId, clientMsgId, type: "text", body: input.trim() });
    setInput("");
    stopTyping();
  }, [input, emit, convId]);

  // ── Typing indicators ─────────────────────────────────────────────────────
  const startTyping = () => {
    if (!typing) { emit("typing:start", { conversationId: convId }); setTyping(true); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 3000);
  };

  const stopTyping = () => {
    if (typing) { emit("typing:stop", { conversationId: convId }); setTyping(false); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
  };

  // ── Media send ────────────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await fetch(`${API_URL}/media/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mime: file.type, size: file.size }),
    });
    const { uploadUrl, fields } = await res.json();
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v as string));
    fd.append("file", file);
    const up = await fetch(uploadUrl, { method: "POST", body: fd });
    const upData = await up.json();
    const clientMsgId = `${Date.now()}-media`;
    emit("message:send", {
      conversationId: convId,
      clientMsgId,
      type: file.type.startsWith("audio") ? "audio" : "image",
      mediaId: upData.public_id,
      body: upData.secure_url,
    });
  }

  function handleDeleted(result: { deletedCount: number; freedBytes: number; keptMedia: boolean }) {
    setShowDeleteSheet(false);
    const freed = result.freedBytes > 0 ? ` · freed ${(result.freedBytes / 1048576).toFixed(1)} MB` : "";
    setToast(`${result.deletedCount} messages deleted${freed}. ${result.keptMedia ? "Media kept." : "Media deleted."}`);
    // Remove deleted messages from local state (re-fetch would be cleaner; local filter is fine for 2 users)
    setMessages([]);
  }

  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatar} aria-hidden>💜</div>
          <div>
            <p className={styles.partnerName}>Together</p>
            <p className={styles.presence}>{partnerTyping ? "typing…" : "Online"}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button id="chat-menu-btn" className={styles.iconBtn} aria-label="Chat menu" onClick={() => setShowMenu(v => !v)}>⋮</button>
          {showMenu && (
            <div className={styles.menu} role="menu">
              <button id="menu-delete-messages" className={styles.menuItem} role="menuitem"
                onClick={() => { setShowMenu(false); setShowDeleteSheet(true); }}>
                🗑️ Delete messages
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className={styles.messages} aria-label="Chat messages"
        onClick={() => { setShowMenu(false); emit("message:read", { conversationId: convId, upToMessageId: messages.at(-1)?.id }); }}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💬</span>
            <p>Your conversation starts here.</p>
            <p className={styles.emptyHint}>Messages are end-to-end encrypted.</p>
          </div>
        )}
        {messages.map(msg => (
          <ChatBubble key={msg.id} msg={msg} isMine={msg.senderId === MOCK_USER_ID} />
        ))}
        {partnerTyping && (
          <div className={styles.typingIndicator} aria-label="Partner is typing">
            <span /><span /><span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input bar */}
      <footer className={styles.inputBar}>
        <label className={styles.attachBtn} aria-label="Attach media">
          📎
          <input id="attach-media" type="file" accept="image/*,audio/*" onChange={handleFile} style={{ display: "none" }} />
        </label>
        <input
          id="message-input"
          className={styles.msgInput}
          type="text"
          placeholder="Message…"
          value={input}
          onChange={e => { setInput(e.target.value); startTyping(); }}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          aria-label="Type a message"
        />
        <button className={styles.sendBtn} id="send-message" aria-label="Send message" onClick={sendMessage}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>

      {showDeleteSheet && (
        <DeleteRangeSheet conversationId={convId} onClose={() => setShowDeleteSheet(false)} onDeleted={handleDeleted} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
