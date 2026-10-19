"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import ChatBubble, { Message, BubbleActions } from "@/components/ChatBubble";
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
  IconDownload,
  IconScreenShare,
  IconEyeOnce,
} from "@/components/Icons";
import { API_URL } from "@/lib/api";
import styles from "./page.module.css";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

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

interface ContactRequestItem {
  id: string;
  fromUserId: string;
  fromName: string;
  fromUsername?: string;
  createdAt: string;
}

export default function ChatPage() {
  const router = useRouter();

  // User & Auth
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);

  // Chats & Contacts
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ContactRequestItem[]>([]);
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

  // Reply
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Profile panel & media/links
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<"media" | "links">("media");

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState("ta-photo.jpg");
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Send options
  const [sendViewOnce, setSendViewOnce] = useState(false);

  // Screen share & Live Camera
  const [sharing, setSharing] = useState(false);
  const [incomingLive, setIncomingLive] = useState<{ sessionId: string; from: string } | null>(null);
  const [viewingRemoteStream, setViewingRemoteStream] = useState<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
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
        if (data.contactCode) {
          setMyContactCode(data.contactCode);
        } else {
          try {
            const codeRes = await fetch(`${API_URL}/me/contact-code`, {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (codeRes.ok) {
              const codeData = await codeRes.json();
              if (codeData.code) setMyContactCode(codeData.code);
            }
          } catch {}
        }
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

      // Only update chats if we got a valid response (don't wipe chats on transient error)
      if (Array.isArray(convList) || Array.isArray(contactList)) {
        setChats(combined);
      }
    } catch (err) {
      console.warn("Failed to load chats:", err);
    }
  }, [token]);

  // ── Fetch Incoming Contact Requests ───────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    const curToken = token || localStorage.getItem("access_token");
    if (!curToken) return;
    try {
      const res = await fetch(`${API_URL}/contacts/requests`, {
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setIncomingRequests(data);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch requests:", err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadChatsAndContacts();
      fetchRequests();
      const interval = setInterval(() => {
        loadChatsAndContacts();
        fetchRequests();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token, loadChatsAndContacts, fetchRequests]);

  const acceptContactRequest = async (requestId: string, fromName: string) => {
    const curToken = token || localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_URL}/contacts/requests/${requestId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        setToast(`Connected with ${fromName}!`);
        await fetchRequests();
        await loadChatsAndContacts();
      }
    } catch {
      setToast("Failed to accept request.");
    }
  };

  const rejectContactRequest = async (requestId: string) => {
    const curToken = token || localStorage.getItem("access_token");
    try {
      await fetch(`${API_URL}/contacts/requests/${requestId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${curToken}` },
      });
      await fetchRequests();
    } catch {}
  };

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

      on("message:deleted", (d: any) => {
        if (d?.messageId) {
          setMessages(prev => prev.filter(m => m.id !== d.messageId));
        }
      }),

      on("message:reacted", (d: any) => {
        if (d?.messageId && d?.userId) {
          setMessages(prev => prev.map(m => {
            if (m.id !== d.messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            if (reactions[d.userId] === d.emoji) delete reactions[d.userId];
            else reactions[d.userId] = d.emoji;
            return { ...m, reactions };
          }));
        }
      }),

      on("screen:requested", (d: any) => {
        if (d?.sessionId && d?.from) {
          setIncomingLive({ sessionId: d.sessionId, from: d.from });
        }
      }),

      on("screen:accepted", async () => {
        const pc = peerConnRef.current;
        if (!pc || !activeChat?.contactId || !activeConvId) return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          emit("screen:offer", { sessionId: activeConvId, to: activeChat.contactId, sdp: JSON.stringify(offer) });
        } catch (err) {
          console.warn("Screen offer error:", err);
        }
      }),

      on("screen:declined", () => {
        setToast("Partner declined live share.");
        stopScreenShare();
      }),

      on("screen:signal", async (sig: any) => {
        const pc = peerConnRef.current;
        if (!pc) return;
        try {
          if (sig.type === "offer" && sig.data) {
            const offerDesc = JSON.parse(sig.data);
            await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (activeChat?.contactId && activeConvId) {
              emit("screen:answer", { sessionId: activeConvId, to: activeChat.contactId, sdp: JSON.stringify(answer) });
            }
          } else if (sig.type === "answer" && sig.data) {
            const answerDesc = JSON.parse(sig.data);
            await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
          } else if (sig.type === "ice" && sig.data) {
            await pc.addIceCandidate(new RTCIceCandidate(sig.data));
          }
        } catch (err) {
          console.warn("Screen signaling error:", err);
        }
      }),

      on("screen:ended", () => {
        if (viewingRemoteStream) {
          viewingRemoteStream.getTracks().forEach(t => t.stop());
          setViewingRemoteStream(null);
        }
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setToast("Live stream ended.");
      }),
    ];

    return () => offs.forEach(off => off?.());
  }, [on, emit, activeConvId, activeChat, me, viewingRemoteStream]);

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
    setReplyTo(null);
    // Keep keyboard open on mobile — refocus the input immediately after clear
    setTimeout(() => msgInputRef.current?.focus(), 0);
    stopTyping();

    emit("message:send", {
      conversationId: activeConvId,
      clientMsgId,
      type: "text",
      body: text,
      replyTo: replyTo?.id,
      replyBody: replyTo?.body?.slice(0, 100),
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
  }, [input, activeConvId, me, emit, replyTo]);

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
    const isVideo = file.type.startsWith("video");
    const mediaType = isAudio ? "audio" : isVideo ? "video" : "image";
    const capturedViewOnce = sendViewOnce && !isAudio;

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
        viewOnce: capturedViewOnce,
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
          viewOnce: capturedViewOnce,
        });
      } catch (err) {
        console.warn("Media upload error:", err);
        setToast("Media sent with local preview.");
      } finally {
        setUploadingMedia(false);
        setSendViewOnce(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsDataURL(file);
  };

  // ── Screen Share & Live Video ─────────────────────────────────────────────
  const startScreenShare = async () => {
    if (!activeConvId || !activeChat) { setToast("Open a conversation first"); return; }

    let stream: MediaStream | null = null;
    let mode: "screen" | "camera" = "screen";

    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getDisplayMedia) {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } catch (displayErr: any) {
          if (displayErr?.name === "NotAllowedError" || displayErr?.name === "AbortError") {
            // User cancelled the prompt quietly
            return;
          }
          mode = "camera";
        }
      } else {
        mode = "camera";
      }

      // Fallback for mobile / devices where getDisplayMedia is unsupported
      if (!stream && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
          mode = "camera";
        } catch (camErr: any) {
          if (camErr?.name === "NotAllowedError") {
            setToast("Camera/Screen permission denied.");
            return;
          }
        }
      }

      if (!stream) {
        setToast("Screen or camera share not available on this device/connection.");
        return;
      }

      screenStreamRef.current = stream;
      setSharing(true);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream!));

      pc.onicecandidate = (event) => {
        if (event.candidate && activeChat?.contactId) {
          emit("screen:ice", { sessionId: activeConvId, to: activeChat.contactId, candidate: event.candidate });
        }
      };

      emit("screen:request", { sessionId: activeConvId, to: activeChat.contactId });

      stream.getTracks()[0].addEventListener("ended", stopScreenShare);
      setToast(mode === "screen" ? "Sharing screen..." : "Sharing live camera...");
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        setToast("Unable to start live stream.");
      }
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
    if (activeConvId && activeChat?.contactId) {
      emit("screen:end", { sessionId: activeConvId, to: activeChat.contactId });
    }
    setSharing(false);
  };

  const acceptLiveStream = async () => {
    if (!incomingLive || !activeChat?.contactId || !activeConvId) return;
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnRef.current = pc;
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        setViewingRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate && incomingLive) {
          emit("screen:ice", { sessionId: incomingLive.sessionId, to: incomingLive.from, candidate: event.candidate });
        }
      };
      emit("screen:accept", { sessionId: incomingLive.sessionId, to: incomingLive.from });
      setIncomingLive(null);
    } catch (err) {
      console.warn("Failed to accept live stream:", err);
    }
  };

  const declineLiveStream = () => {
    if (incomingLive) {
      emit("screen:decline", { sessionId: incomingLive.sessionId, to: incomingLive.from });
      setIncomingLive(null);
    }
  };

  // ── Lightbox ──────────────────────────────────────────────────────────────
  const openLightbox = (url: string, name: string, type: "image" | "video" = "image") => {
    setLightboxUrl(url);
    setLightboxName(name);
    setLightboxType(type);
    setLightboxZoom(1);
  };

  const closeLightbox = () => {
    setLightboxUrl(null);
    setLightboxZoom(1);
  };

  const downloadLightboxMedia = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightboxUrl) return;
    try {
      if (lightboxUrl.startsWith("data:") || lightboxUrl.startsWith("blob:")) {
        const a = document.createElement("a");
        a.href = lightboxUrl;
        a.download = lightboxName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const res = await fetch(lightboxUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = lightboxName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
      setToast("Download started!");
    } catch {
      window.open(lightboxUrl, "_blank");
    }
  };

  // ── Delete single message ──────────────────────────────────────────────────
  const deleteMessage = useCallback(async (msg: Message, scope: "me" | "all") => {
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    if (activeConvId) {
      emit("message:delete", { conversationId: activeConvId, messageId: msg.id, scope });
    }
    if (scope === "all") {
      try {
        const curToken = token || localStorage.getItem("access_token");
        await fetch(`${API_URL}/messages/${msg.id}?scope=all`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${curToken}` },
        });
      } catch { /* optimistic deletion already applied */ }
    }
  }, [token, activeConvId, emit]);

  // ── Reply ─────────────────────────────────────────────────────────────────
  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg);
    msgInputRef.current?.focus();
  }, []);

  // ── Reactions ─────────────────────────────────────────────────────────────
  const handleReact = useCallback((msg: Message, emoji: string) => {
    const myId = me?.id || "me";
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const reactions = { ...(m.reactions || {}) };
      if (reactions[myId] === emoji) delete reactions[myId]; // toggle off
      else reactions[myId] = emoji;
      return { ...m, reactions };
    }));
    if (activeConvId) {
      emit("message:react", { conversationId: activeConvId, messageId: msg.id, emoji });
    }
  }, [me, activeConvId, emit]);

  // ── Bubble Actions memoized ───────────────────────────────────────────────
  const bubbleActions: BubbleActions = useMemo(() => ({
    onDelete: deleteMessage,
    onReply: handleReply,
    onReact: handleReact,
    onMediaClick: openLightbox,
  }), [deleteMessage, handleReply, handleReact]);

  // ── Media & Links for Profile Panel ───────────────────────────────────────
  const chatMediaList = useMemo(() => {
    return messages.filter(m => (m.type === "image" || m.type === "video") && (m.mediaUrl || m.body));
  }, [messages]);

  const chatLinksList = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const items: { url: string; time: string }[] = [];
    for (const m of messages) {
      if (m.type === "text" && m.body) {
        const matches = m.body.match(urlRegex);
        if (matches) {
          const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          for (const u of matches) {
            items.push({ url: u, time });
          }
        }
      }
    }
    return items;
  }, [messages]);

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
        setToast(data?.error?.message || data?.message || "Failed to add partner");
      } else {
        if (data?.autoAccepted) {
          setToast(`Connected with ${data.targetName || "partner"}!`);
        } else {
          setToast(`Request sent to ${data?.targetName || "partner"}!`);
        }
        setShowAddModal(false);
        setNewContactCode("");
        await fetchRequests();
        await loadChatsAndContacts();
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
              title={incomingRequests.length > 0 ? `Incoming Requests (${incomingRequests.length})` : "Add Partner"}
              aria-label="Add Partner"
              style={{ position: "relative" }}
              onClick={() => setShowAddModal(true)}
            >
              <IconUserPlus size={20} color={incomingRequests.length > 0 ? "#00a884" : "#aebac1"} />
              {incomingRequests.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "#25d366",
                    color: "#111b21",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    borderRadius: "10px",
                    padding: "1px 5px",
                    lineHeight: 1,
                  }}
                >
                  {incomingRequests.length}
                </span>
              )}
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

        {/* ── Incoming Partner Requests Section ──────────────────────────── */}
        {incomingRequests.length > 0 && (
          <div className={styles.requestsSection}>
            <div className={styles.requestCardHeader}>
              <span className={styles.requestBadgeTitle}>
                <span>📩</span> Partner Request ({incomingRequests.length})
              </span>
            </div>
            {incomingRequests.map(req => (
              <div key={req.id} className={styles.requestCard}>
                <div className={styles.requestItem}>
                  <div className={styles.avatarWrap}>
                    <div className={styles.avatar}>
                      {(req.fromName || "P").charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className={styles.requestInfo}>
                    <div className={styles.requestName}>{req.fromName}</div>
                    <div className={styles.requestSub}>
                      {req.fromUsername ? `@${req.fromUsername} ` : ""}wants to connect
                    </div>
                    <div className={styles.requestActions}>
                      <button
                        className={styles.acceptBtn}
                        onClick={() => acceptContactRequest(req.id, req.fromName)}
                      >
                        ✓ Accept
                      </button>
                      <button
                        className={styles.declineBtn}
                        onClick={() => rejectContactRequest(req.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
              <button
                type="button"
                className={styles.backBtn}
                aria-label="Back to contacts"
                title="Back"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveChat(null);
                  loadChatsAndContacts();
                }}
              >
                <IconBack size={22} />
              </button>

              <div
                className={styles.chatHeaderLeft}
                onClick={() => setShowProfile(true)}
                title="View partner profile, media & links"
              >
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
                        setShowProfile(true);
                      }}
                    >
                      👤 Contact Info
                    </button>
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

            {/* Incoming Live Share Request Banner */}
            {incomingLive && (
              <div className={styles.incomingLiveBanner}>
                <div className={styles.incomingLiveText}>
                  <span>🎥</span>
                  <span>{activeChat.displayName} is sharing live screen/camera!</span>
                </div>
                <div className={styles.incomingLiveBtns}>
                  <button className={styles.incomingLiveWatchBtn} onClick={acceptLiveStream}>
                    Watch Live
                  </button>
                  <button className={styles.incomingLiveDeclineBtn} onClick={declineLiveStream}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Remote Live Video Player */}
            {viewingRemoteStream && (
              <div className={styles.remoteVideoOverlay}>
                <div className={styles.remoteVideoHeader}>
                  <span>🔴 Live Stream from {activeChat.displayName}</span>
                  <button
                    className={styles.remoteVideoClose}
                    onClick={() => {
                      viewingRemoteStream.getTracks().forEach(t => t.stop());
                      setViewingRemoteStream(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <video
                  ref={remoteVideoRef}
                  className={styles.remoteVideoElement}
                  autoPlay
                  playsInline
                  controls
                />
              </div>
            )}

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
                  actions={bubbleActions}
                />
              ))}

              {partnerTyping && (
                <div className={styles.typingBubble} aria-label="Partner is typing">
                  <span /><span /><span />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview Bar */}
            {replyTo && (
              <div className={styles.replyBar}>
                <div className={styles.replyBarLeft}>
                  <span className={styles.replyBarTitle}>
                    Replying to {replyTo.senderId === (me?.id || "me") ? "yourself" : activeChat.displayName}
                  </span>
                  <span className={styles.replyBarSnippet}>
                    {replyTo.type === "image" ? "📷 Photo" : replyTo.type === "video" ? "🎥 Video" : replyTo.body || "Media"}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.replyBarClose}
                  onClick={() => setReplyTo(null)}
                  title="Cancel reply"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Bottom Input Bar */}
            <form
              className={styles.inputBar}
              onSubmit={e => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*"
                className={styles.mediaInput}
                onChange={handleFileSelect}
              />

              {/* Attach */}
              <button
                type="button"
                className={styles.iconBtn}
                title="Attach photo or audio"
                aria-label="Attach file"
                disabled={uploadingMedia}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPaperclip size={20} color={uploadingMedia ? "#00a884" : "#8696a0"} />
              </button>

              {/* View-Once Toggle */}
              <button
                type="button"
                className={styles.iconBtn}
                title={sendViewOnce ? "View-once ON — next photo burns after viewing" : "Send as view-once photo"}
                aria-label="View once"
                onClick={() => setSendViewOnce(v => !v)}
                style={{ position: "relative" }}
              >
                <IconEyeOnce size={20} color={sendViewOnce ? "#00a884" : "#8696a0"} />
                {sendViewOnce && (
                  <span style={{
                    position: "absolute", top: 4, right: 4,
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#00a884", border: "1.5px solid #202c33"
                  }} />
                )}
              </button>

              {/* Screen Share / Live Camera */}
              <button
                type="button"
                className={styles.iconBtn}
                title={sharing ? "Stop live share" : "Share screen or live camera"}
                aria-label="Screen share"
                onClick={sharing ? stopScreenShare : startScreenShare}
              >
                <IconScreenShare size={20} color={sharing ? "#25d366" : "#8696a0"} />
              </button>

              <div className={styles.inputCapsule}>
                <input
                  ref={msgInputRef}
                  type="text"
                  placeholder="Type a message"
                  className={styles.msgInput}
                  value={input}
                  onChange={handleInputChange}
                  enterKeyHint="send"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </div>

              <button
                type="submit"
                className={styles.sendBtn}
                aria-label="Send message"
                disabled={!input.trim()}
                onPointerDown={e => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <IconSend size={18} color="#ffffff" />
              </button>
            </form>

            {/* Screen Share Preview */}
            {sharing && (
              <div className={styles.screenShareBar}>
                <span className={styles.screenShareDot} />
                <span className={styles.screenShareLabel}>Sharing live stream</span>
                <video ref={screenVideoRef} className={styles.screenShareThumb} muted autoPlay playsInline />
                <button className={styles.screenShareStop} onClick={stopScreenShare}>Stop</button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Add Partner Modal ────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Partner</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {/* Show incoming requests inside modal too */}
              {incomingRequests.length > 0 && (
                <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(0, 168, 132, 0.12)", border: "1px solid rgba(0, 168, 132, 0.4)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#00a884", marginBottom: "8px", textTransform: "uppercase" }}>
                    📩 Pending Partner Requests ({incomingRequests.length})
                  </div>
                  {incomingRequests.map(req => (
                    <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "6px" }}>
                      <div>
                        <div style={{ color: "#e9edef", fontWeight: 600, fontSize: "0.9rem" }}>{req.fromName}</div>
                        <div style={{ color: "#8696a0", fontSize: "0.75rem" }}>
                          {req.fromUsername ? `@${req.fromUsername}` : "Wants to connect"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className={styles.acceptBtn}
                          style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                          onClick={() => {
                            acceptContactRequest(req.id, req.fromName);
                            setShowAddModal(false);
                          }}
                        >
                          ✓ Accept
                        </button>
                        <button
                          className={styles.declineBtn}
                          style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                          onClick={() => rejectContactRequest(req.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddContact}>
                <p className={styles.modalHint}>
                  Enter your partner&apos;s <strong>Secret Code</strong> or <strong>Username</strong>:
                </p>
                <input
                  type="text"
                  maxLength={32}
                  placeholder="e.g. 7K2M9XPQ4W or username"
                  className={styles.modalInput}
                  value={newContactCode}
                  onChange={e => setNewContactCode(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className={styles.modalBtn}
                  disabled={addLoading || !newContactCode.trim()}
                >
                  {addLoading ? "Connecting…" : "Send Partner Request"}
                </button>
              </form>

              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(134, 150, 160, 0.15)", textAlign: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#8696a0" }}>Your Secret Code: </span>
                <strong
                  style={{ color: "#00a884", letterSpacing: "1px", cursor: "pointer", marginLeft: "4px" }}
                  onClick={copyMyCode}
                  title="Click to copy"
                >
                  {myContactCode || "Loading…"} 📋
                </strong>
                {me?.username && (
                  <div style={{ fontSize: "0.75rem", color: "#8696a0", marginTop: "4px" }}>
                    Or tell your partner your username: <span style={{ color: "#e9edef", fontWeight: 600 }}>@{me.username}</span>
                  </div>
                )}
              </div>
            </div>
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

      {/* ── Partner Profile & Media/Links Panel ──────────────────────────── */}
      {showProfile && activeChat && (
        <div className={styles.profileOverlay} onClick={() => setShowProfile(false)}>
          <aside className={styles.profilePanel} onClick={e => e.stopPropagation()}>
            <header className={styles.profileHeader}>
              <button
                type="button"
                className={styles.profileCloseBtn}
                onClick={() => setShowProfile(false)}
                title="Close"
              >
                ✕
              </button>
              <h3 className={styles.profileTitle}>Contact Info</h3>
            </header>

            <div className={styles.profileHero}>
              <div className={styles.profileAvatar}>
                {(activeChat.displayName || "U").charAt(0).toUpperCase()}
              </div>
              <h2 className={styles.profileName}>{activeChat.displayName}</h2>
              {activeChat.username && (
                <span className={styles.profileUsername}>@{activeChat.username}</span>
              )}
              <div className={styles.profileStatusPill}>
                <span className={partnerOnline ? styles.onlineDot : styles.offlineDot} />
                <span>{partnerTyping ? "typing…" : partnerOnline ? "Online" : "Offline"}</span>
              </div>
            </div>

            {/* Media & Links Tabs */}
            <div className={styles.profileTabs}>
              <button
                type="button"
                className={`${styles.profileTab} ${profileTab === "media" ? styles.profileTabActive : ""}`}
                onClick={() => setProfileTab("media")}
              >
                📷 Media ({chatMediaList.length})
              </button>
              <button
                type="button"
                className={`${styles.profileTab} ${profileTab === "links" ? styles.profileTabActive : ""}`}
                onClick={() => setProfileTab("links")}
              >
                🔗 Links ({chatLinksList.length})
              </button>
            </div>

            {/* Tab content */}
            <div className={styles.profileContent}>
              {profileTab === "media" ? (
                chatMediaList.length === 0 ? (
                  <div className={styles.profileEmpty}>
                    <p>No photos or videos in this chat yet.</p>
                  </div>
                ) : (
                  <div className={styles.profileMediaGrid}>
                    {chatMediaList.map((m, idx) => {
                      const url = m.mediaUrl || m.body || "";
                      const isVid = m.type === "video";
                      return (
                        <div
                          key={m.id || idx}
                          className={styles.profileMediaThumb}
                          onClick={() => openLightbox(url, `ta-${m.type}-${idx}.jpg`, isVid ? "video" : "image")}
                        >
                          {isVid ? (
                            <video src={url} className={styles.profileMediaImg} preload="metadata" muted />
                          ) : (
                            <img src={url} alt="Media" className={styles.profileMediaImg} loading="lazy" />
                          )}
                          {isVid && <span className={styles.profileMediaVideoBadge}>▶</span>}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                chatLinksList.length === 0 ? (
                  <div className={styles.profileEmpty}>
                    <p>No links shared in this chat yet.</p>
                  </div>
                ) : (
                  <div className={styles.profileLinksList}>
                    {chatLinksList.map((item, idx) => (
                      <a
                        key={idx}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.profileLinkCard}
                      >
                        <span className={styles.profileLinkIcon}>🔗</span>
                        <div className={styles.profileLinkDetails}>
                          <span className={styles.profileLinkUrl}>{item.url}</span>
                          <span className={styles.profileLinkTime}>{item.time}</span>
                        </div>
                        <span className={styles.profileLinkArrow}>↗</span>
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className={styles.profileSecurityCard}>
              <IconLock size={16} color="#00a884" />
              <div>
                <strong>End-to-End Encrypted</strong>
                <p>Messages and media are secured between your devices with private keys.</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Media Lightbox (image + video) ──────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className={styles.lightboxOverlay}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
        >
          <div className={styles.lightboxToolbar} onClick={e => e.stopPropagation()}>
            <span className={styles.lightboxTitle}>{lightboxType === "video" ? "Video" : "Photo"}</span>
            <div className={styles.lightboxActions}>
              {lightboxType === "image" && (
                <>
                  <button
                    type="button"
                    className={styles.lightboxBtn}
                    title="Zoom Out (-)"
                    onClick={() => setLightboxZoom(z => Math.max(0.5, +(z - 0.5).toFixed(1)))}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e9edef" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </button>
                  <span className={styles.lightboxZoomText}>{Math.round(lightboxZoom * 100)}%</span>
                  <button
                    type="button"
                    className={styles.lightboxBtn}
                    title="Zoom In (+)"
                    onClick={() => setLightboxZoom(z => Math.min(4, +(z + 0.5).toFixed(1)))}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e9edef" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      <line x1="11" y1="8" x2="11" y2="14" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </button>
                  {lightboxZoom !== 1 && (
                    <button
                      type="button"
                      className={styles.lightboxBtn}
                      title="Reset Zoom"
                      onClick={() => setLightboxZoom(1)}
                    >
                      1:1
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                className={styles.lightboxBtn}
                title="Download"
                onClick={downloadLightboxMedia}
              >
                <IconDownload size={22} color="#e9edef" />
              </button>
              <button type="button" className={styles.lightboxBtn} title="Close" onClick={closeLightbox}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e9edef" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.lightboxImgWrap} onClick={e => e.stopPropagation()}>
            {lightboxType === "video" ? (
              <video
                src={lightboxUrl}
                controls
                autoPlay
                className={styles.lightboxVideo}
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxUrl}
                alt="Full size photo"
                className={styles.lightboxImg}
                draggable={false}
                style={{
                  transform: `scale(${lightboxZoom})`,
                  transition: "transform 0.18s ease-out",
                  cursor: lightboxZoom > 1 ? "grab" : "zoom-in",
                }}
                onDoubleClick={() => setLightboxZoom(z => (z === 1 ? 2.5 : 1))}
              />
            )}
          </div>
          <div className={styles.lightboxHint}>Double-tap or pinch to zoom &middot; Tap outside to close</div>
        </div>
      )}
    </div>
  );
}
