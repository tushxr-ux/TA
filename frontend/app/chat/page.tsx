"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import ChatBubble, { Message } from "@/components/ChatBubble";
import DeleteRangeSheet from "@/components/DeleteRangeSheet";
import Toast from "@/components/Toast";
import {
  IconTALogo,
  IconSearch,
  IconKey,
  IconUserPlus,
  IconLogout,
  IconBack,
  IconPaperclip,
  IconSend,
  IconMore,
  IconLock,
} from "@/components/Icons";
import { API_URL } from "@/lib/api";
import styles from "./page.module.css";

interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  contactCode?: string;
}

interface ChatItem {
  id?: string;             // conversationId
  contactId: string;       // partner's userId
  displayName: string;
  username?: string;
  lastSeenAt?: string;
  lastMessage?: {
    id: string;
    senderId: string;
    type: string;
    body?: string;
    createdAt: string;
  } | null;
  unreadCount?: number;
}

export default function ChatPage() {
  const router = useRouter();

  // User & Auth
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);

  // Chats & Contacts
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Messages & State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Modals & Sheets
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [newContactCode, setNewContactCode] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [myContactCode, setMyContactCode] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { emit, on } = useSocket(token);

  // ── Auth initialization ───────────────────────────────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);

    async function loadMe(currentToken: string) {
      try {
        let res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        if (res.status === 401) {
          const refreshToken = localStorage.getItem("refresh_token");
          if (refreshToken) {
            const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.access_token) {
                localStorage.setItem("access_token", refreshData.access_token);
                setToken(refreshData.access_token);
                res = await fetch(`${API_URL}/me`, {
                  headers: { Authorization: `Bearer ${refreshData.access_token}` },
                });
              }
            }
          }
        }

        if (!res.ok) {
          localStorage.removeItem("access_token");
          router.replace("/login");
          return;
        }

        const data = await res.json();
        setMe(data);
        if (data.contactCode) setMyContactCode(data.contactCode);
      } catch {
        // network temporary fallback
      }
    }

    loadMe(storedToken);
  }, [router]);

  // ── Load Chats & Contacts ─────────────────────────────────────────────────
  const loadChatsAndContacts = useCallback(async () => {
    const curToken = token || localStorage.getItem("access_token");
    if (!curToken) return;

    try {
      const [convRes, contactsRes] = await Promise.all([
        fetch(`${API_URL}/conversations`, { headers: { Authorization: `Bearer ${curToken}` } }).catch(() => null),
        fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${curToken}` } }).catch(() => null),
      ]);

      const convList: any[] = convRes?.ok ? await convRes.json() : [];
      const contactList: any[] = contactsRes?.ok ? await contactsRes.json() : [];

      const combined: ChatItem[] = [];
      const seenContactIds = new Set<string>();

      // Active conversations first
      if (Array.isArray(convList)) {
        for (const c of convList) {
          const partnerId = c.partner_id;
          if (partnerId) seenContactIds.add(partnerId);

          let lastMsg = null;
          if (c.last_message) {
            lastMsg = typeof c.last_message === "string" ? JSON.parse(c.last_message) : c.last_message;
          }

          combined.push({
            id: c.id,
            contactId: partnerId,
            displayName: c.partner_name || c.partner_username || "Chat",
            username: c.partner_username,
            lastSeenAt: c.partner_last_seen,
            lastMessage: lastMsg,
            unreadCount: c.unread_count || 0,
          });
        }
      }

      // Add contacts without conversation yet
      if (Array.isArray(contactList)) {
        for (const ct of contactList) {
          if (!seenContactIds.has(ct.contactId)) {
            combined.push({
              contactId: ct.contactId,
              displayName: ct.displayName || ct.nickname || ct.username || "Contact",
              username: ct.username,
              lastSeenAt: ct.lastSeenAt,
              lastMessage: null,
              unreadCount: 0,
            });
          }
        }
      }

      setChats(combined);
    } catch (err) {
      console.warn("Failed to load chats:", err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadChatsAndContacts();
    }
  }, [token, loadChatsAndContacts]);

  // ── Fetch Message History ─────────────────────────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    const curToken = token || localStorage.getItem("access_token");
    if (!curToken || !convId) return;

    try {
      const res = await fetch(`${API_URL}/conversations/${convId}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        const history = await res.json();
        setMessages(history);
      }
    } catch (err) {
      console.warn("Failed to fetch messages:", err);
    }
  }, [token]);

  // ── Select Contact ────────────────────────────────────────────────────────
  const selectChat = async (item: ChatItem) => {
    setActiveChat(item);
    setPartnerTyping(false);
    setPartnerOnline(true);

    const curToken = token || localStorage.getItem("access_token");
    let convId = item.id;

    if (!convId && item.contactId) {
      try {
        const res = await fetch(`${API_URL}/conversations/direct/${item.contactId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${curToken}` },
        });
        if (res.ok) {
          const directConv = await res.json();
          convId = directConv.id;
        }
      } catch (err) {
        console.warn("Failed to create direct conversation:", err);
      }
    }

    if (convId) {
      setActiveConvId(convId);
      emit("conversation:join", { conversationId: convId });
      await fetchMessages(convId);
    } else {
      setMessages([]);
    }
  };

  // ── Socket Events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      on("message:new", (msg: any) => {
        if (activeConvId && msg.conversationId === activeConvId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id || (msg.clientMsgId && m.id === msg.clientMsgId))) {
              return prev;
            }
            return [...prev, msg as Message];
          });
          emit("message:delivered", { messageId: msg.id });
        }

        setChats(prev => prev.map(c => {
          if (c.id === msg.conversationId || c.contactId === msg.senderId) {
            return {
              ...c,
              id: c.id || msg.conversationId,
              lastMessage: {
                id: msg.id,
                senderId: msg.senderId,
                type: msg.type || "text",
                body: msg.body,
                createdAt: msg.createdAt || new Date().toISOString(),
              },
            };
          }
          return c;
        }));
      }),

      on("message:ack", (ack: any) => {
        setMessages(prev => prev.map(m =>
          m.id === ack.clientMsgId ? { ...m, id: ack.messageId, status: "sent" } : m
        ));
      }),

      on("message:status", (s: any) => {
        setMessages(prev => prev.map(m => m.id === s.messageId ? { ...m, status: s.status } : m));
      }),

      on("typing", (t: any) => {
        if (t.conversationId === activeConvId && t.userId !== me?.id) {
          setPartnerTyping(Boolean(t.isTyping));
        }
      }),

      on("presence", (p: any) => {
        if (activeChat?.contactId === p.userId) {
          setPartnerOnline(Boolean(p.online));
        }
      }),
    ];

    return () => offs.forEach(off => off?.());
  }, [on, emit, activeConvId, activeChat, me]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // ── Send Message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!input.trim() || !activeConvId) return;
    const text = input.trim();
    const clientMsgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const myId = me?.id || "me";

    const optimistic: Message = {
      id: clientMsgId,
      senderId: myId,
      type: "text",
      body: text,
      createdAt: new Date().toISOString(),
      status: "sent",
    };

    setMessages(prev => [...prev, optimistic]);
    setInput("");
    stopTyping();

    emit("message:send", {
      conversationId: activeConvId,
      clientMsgId,
      type: "text",
      body: text,
    });

    setChats(prev => prev.map(c => {
      if (c.id === activeConvId) {
        return {
          ...c,
          lastMessage: {
            id: clientMsgId,
            senderId: myId,
            type: "text",
            body: text,
            createdAt: new Date().toISOString(),
          },
        };
      }
      return c;
    }));
  }, [input, activeConvId, me, emit]);

  // ── Typing Indicator ──────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!activeConvId) return;
    if (!typing) {
      emit("typing:start", { conversationId: activeConvId });
      setTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 3000);
  };

  const stopTyping = () => {
    if (typing && activeConvId) {
      emit("typing:stop", { conversationId: activeConvId });
      setTyping(false);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
  };

  // ── Media Send ────────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    setUploadingMedia(true);
    const clientMsgId = `${Date.now()}-media`;
    const myId = me?.id || "me";
    const isAudio = file.type.startsWith("audio");
    const mediaType = isAudio ? "audio" : "image";

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Str = reader.result as string;

      const optimistic: Message = {
        id: clientMsgId,
        senderId: myId,
        type: mediaType,
        body: base64Str,
        mediaUrl: base64Str,
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      setMessages(prev => [...prev, optimistic]);

      try {
        const curToken = token || localStorage.getItem("access_token");
        const res = await fetch(`${API_URL}/media/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${curToken}`,
          },
          body: JSON.stringify({ file: base64Str, mime: file.type }),
        });

        const uploadData = await res.json();
        const uploadedUrl = uploadData.url || base64Str;

        emit("message:send", {
          conversationId: activeConvId,
          clientMsgId,
          type: mediaType,
          mediaId: uploadData.mediaId || "inline",
          body: uploadedUrl,
        });
      } catch (err) {
        console.warn("Media upload error:", err);
        setToast("Media sent with local preview.");
      } finally {
        setUploadingMedia(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsDataURL(file);
  };

  // ── Add Contact ───────────────────────────────────────────────────────────
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactCode.trim()) return;

    setAddLoading(true);
    try {
      const curToken = token || localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/contacts/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${curToken}`,
        },
        body: JSON.stringify({ code: newContactCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast(data?.error?.message || data?.message || "Failed to add contact");
      } else {
        setToast("Contact request sent!");
        setShowAddModal(false);
        setNewContactCode("");
        loadChatsAndContacts();
      }
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Copy Personal Code ────────────────────────────────────────────────────
  const copyMyCode = async () => {
    let code = myContactCode;
    if (!code) {
      try {
        const curToken = token || localStorage.getItem("access_token");
        const res = await fetch(`${API_URL}/me/contact-code`, {
          headers: { Authorization: `Bearer ${curToken}` },
        });
        const data = await res.json();
        code = data.code;
        setMyContactCode(code);
      } catch {}
    }

    if (code) {
      navigator.clipboard.writeText(code);
      setToast("Code copied to clipboard!");
    }
  };

  const filteredChats = chats.filter(c =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={styles.shell}>
      {/* ── Left Sidebar (Chats List) ────────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${activeChat ? styles.sidebarHiddenMobile : ""}`}>
        <header className={styles.sidebarHeader}>
          <div className={styles.brandGroup}>
            <IconTALogo size={34} />
            <span className={styles.brandName}>TA</span>
            <span className={styles.brandTag}>Private</span>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              title="My Contact Code"
              aria-label="My Contact Code"
              onClick={() => {
                setShowCodeModal(true);
                copyMyCode();
              }}
            >
              <IconKey size={20} />
            </button>
            <button
              className={styles.iconBtn}
              title="Add Contact"
              aria-label="Add Contact"
              onClick={() => setShowAddModal(true)}
            >
              <IconUserPlus size={20} />
            </button>
            <button
              className={styles.iconBtn}
              title="Log out"
              aria-label="Log out"
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                window.location.href = "/login";
              }}
            >
              <IconLogout size={20} />
            </button>
          </div>
        </header>

        {/* Search */}
        <div className={styles.searchWrap}>
          <div className={styles.searchBox}>
            <IconSearch size={16} />
            <input
              type="text"
              placeholder="Search or start new chat"
              className={styles.searchInput}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chats List */}
        <div className={styles.chatList} role="list">
          {filteredChats.length === 0 ? (
            <div className={styles.emptyState}>
              <IconTALogo size={52} />
              <p className={styles.emptyTitle}>No conversations yet</p>
              <p className={styles.emptySubtitle}>
                Add your partner using their secret code to start your private chat.
              </p>
              <button className={styles.addContactBtn} onClick={() => setShowAddModal(true)}>
                <IconUserPlus size={18} color="#ffffff" />
                Add Partner
              </button>
            </div>
          ) : (
            filteredChats.map(c => {
              const initial = (c.displayName || "U").charAt(0).toUpperCase();
              const isSelected = activeChat?.contactId === c.contactId;
              const lastMsgTime = c.lastMessage?.createdAt
                ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";

              return (
                <div
                  key={c.contactId || c.id}
                  className={`${styles.chatItem} ${isSelected ? styles.chatItemActive : ""}`}
                  onClick={() => selectChat(c)}
                  role="listitem"
                >
                  <div className={styles.avatarWrap}>
                    <div className={styles.avatar}>{initial}</div>
                    <span className={styles.onlineBadge} />
                  </div>
                  <div className={styles.chatItemContent}>
                    <div className={styles.chatItemTop}>
                      <span className={styles.chatItemName}>{c.displayName}</span>
                      {lastMsgTime && <span className={styles.chatItemTime}>{lastMsgTime}</span>}
                    </div>
                    <div className={styles.chatItemBottom}>
                      <span className={styles.chatItemSnippet}>
                        {c.lastMessage
                          ? c.lastMessage.type === "image"
                            ? "📷 Photo"
                            : c.lastMessage.type === "audio"
                            ? "🎵 Audio message"
                            : c.lastMessage.body
                          : "Tap to chat"}
                      </span>
                      {Boolean(c.unreadCount && c.unreadCount > 0) && (
                        <span className={styles.unreadBadge}>{c.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main Chat Room ───────────────────────────────────────────────────── */}
      <main className={`${styles.chatArea} ${!activeChat ? styles.chatHiddenMobile : ""}`}>
        {!activeChat ? (
          <div className={styles.placeholderArea}>
            <div className={styles.placeholderGlow}>
              <IconTALogo size={64} />
            </div>
            <h1 className={styles.placeholderTitle}>TA for Web & Mobile</h1>
            <p className={styles.placeholderSubtitle}>
              Private, high-performance messaging for two. Send messages and media with end-to-end security.
            </p>
            <div className={styles.placeholderEncrypted}>
              <IconLock size={14} color="#667781" />
              <span>End-to-end encrypted</span>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Room Header */}
            <header className={styles.chatHeader}>
              <div
                className={styles.chatHeaderLeft}
                onClick={() => {
                  setActiveChat(null);
                  loadChatsAndContacts();
                }}
              >
                <button
                  className={styles.backBtn}
                  aria-label="Back to contacts"
                  title="Back"
                >
                  <IconBack size={22} />
                </button>
                <div className={styles.avatarWrap}>
                  <div className={styles.avatar}>
                    {(activeChat.displayName || "U").charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className={styles.chatHeaderInfo}>
                  <h2 className={styles.chatHeaderName}>{activeChat.displayName}</h2>
                  <span className={partnerTyping || partnerOnline ? styles.chatHeaderStatus : styles.chatHeaderStatusOffline}>
                    {partnerTyping ? "typing…" : partnerOnline ? "online" : "offline"}
                  </span>
                </div>
              </div>

              <div className={styles.chatHeaderRight}>
                <button
                  className={styles.iconBtn}
                  aria-label="Chat menu"
                  onClick={() => setShowMenu(v => !v)}
                >
                  <IconMore size={20} />
                </button>
                {showMenu && (
                  <div className={styles.menu} role="menu">
                    <button
                      className={styles.menuItem}
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteSheet(true);
                      }}
                    >
                      🗑️ Delete messages
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Messages Area */}
            <div
              className={styles.messages}
              onClick={() => {
                setShowMenu(false);
                if (activeConvId && messages.length > 0) {
                  emit("message:read", {
                    conversationId: activeConvId,
                    upToMessageId: messages.at(-1)?.id,
                  });
                }
              }}
            >
              <div className={styles.e2eNotice}>
                <IconLock size={14} color="#ffd279" />
                <span>Messages are end-to-end encrypted. Nobody outside of this chat can read them.</span>
              </div>

              {messages.map(msg => (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  isMine={msg.senderId === (me?.id || "me")}
                />
              ))}

              {partnerTyping && (
                <div className={styles.typingBubble} aria-label="Partner is typing">
                  <span /><span /><span />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Bar */}
            <footer className={styles.inputBar}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*"
                className={styles.mediaInput}
                onChange={handleFileSelect}
              />
              <button
                className={styles.iconBtn}
                title="Attach photo or audio"
                aria-label="Attach file"
                disabled={uploadingMedia}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPaperclip size={20} color={uploadingMedia ? "#00a884" : "#8696a0"} />
              </button>

              <div className={styles.inputCapsule}>
                <input
                  type="text"
                  placeholder="Type a message"
                  className={styles.msgInput}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </div>

              <button
                className={styles.sendBtn}
                aria-label="Send message"
                disabled={!input.trim()}
                onClick={sendMessage}
              >
                <IconSend size={18} color="#ffffff" />
              </button>
            </footer>
          </>
        )}
      </main>

      {/* ── Add Contact Modal ────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Partner</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddContact} className={styles.modalBody}>
              <p className={styles.modalHint}>
                Enter your partner&apos;s 10-character secret code to connect:
              </p>
              <input
                type="text"
                maxLength={12}
                placeholder="e.g. 7K2M9XPQ4W"
                className={styles.modalInput}
                value={newContactCode}
                onChange={e => setNewContactCode(e.target.value.toUpperCase())}
                autoFocus
              />
              <button
                type="submit"
                className={styles.modalBtn}
                disabled={addLoading || !newContactCode.trim()}
              >
                {addLoading ? "Connecting…" : "Send Contact Request"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── My Contact Code Modal ────────────────────────────────────────────── */}
      {showCodeModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCodeModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Your Secret Code</h3>
              <button className={styles.closeBtn} onClick={() => setShowCodeModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalHint}>
                Share this 10-character code with your partner so they can add you:
              </p>
              <div className={styles.codeBox} onClick={copyMyCode} title="Click to copy">
                {myContactCode || "Loading…"}
              </div>
              <button className={styles.modalBtn} onClick={copyMyCode}>
                📋 Copy Code to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Date-range Delete Sheet ─────────────────────────────────────────── */}
      {showDeleteSheet && activeConvId && (
        <DeleteRangeSheet
          conversationId={activeConvId}
          onClose={() => setShowDeleteSheet(false)}
          onDeleted={res => {
            setShowDeleteSheet(false);
            setToast(`${res.deletedCount} messages deleted.`);
            if (activeConvId) fetchMessages(activeConvId);
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
