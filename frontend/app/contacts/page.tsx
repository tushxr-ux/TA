"use client";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { API_URL } from "@/lib/api";
import styles from "./page.module.css";

interface ContactRequest { id: string; fromUserId: string; status: string; createdAt: string; }

export default function ContactsPage() {
  const [myCode, setMyCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [addCode, setAddCode] = useState("");
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [tab, setTab] = useState<"code" | "add" | "requests">("code");
  const [toast, setToast] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const API = API_URL;

  useEffect(() => { fetchCode(); fetchRequests(); }, []);

  async function fetchCode() {
    const res = await fetch(`${API}/me/contact-code`, { headers: { Authorization: `Bearer ${token}` } });
    const { code } = await res.json();
    setMyCode(code);
    const url = await QRCode.toDataURL(code, { width: 220, margin: 2, color: { dark: "#ffffff", light: "#1a1a2e" } });
    setQrDataUrl(url);
  }

  async function fetchRequests() {
    const res = await fetch(`${API}/contacts/requests`, { headers: { Authorization: `Bearer ${token}` } });
    setRequests(await res.json());
  }

  async function regenerateCode() {
    await fetch(`${API}/me/contact-code/regenerate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    fetchCode();
    setToast("Code regenerated. Old code no longer works.");
  }

  async function sendRequest() {
    if (!addCode.trim()) return;
    const res = await fetch(`${API}/contacts/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: addCode.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setToast(data?.error?.message ?? "Failed"); return; }
    setAddCode("");
    setToast("Contact request sent!");
    setTab("requests");
    fetchRequests();
  }

  async function respond(id: string, action: "accept" | "reject") {
    await fetch(`${API}/contacts/requests/${id}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setToast(action === "accept" ? "Contact added!" : "Request rejected.");
    fetchRequests();
  }

  const pending = requests.filter(r => r.status === "pending");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Contacts</h1>
      </header>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        {(["code", "add", "requests"] as const).map(t => (
          <button
            key={t}
            id={`tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "code" ? "My Code" : t === "add" ? "Add" : `Requests${pending.length ? ` (${pending.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* My Code tab */}
      {tab === "code" && (
        <div className={styles.codeTab}>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Your QR code" className={styles.qr} />
          )}
          <p className={styles.codeLabel}>Your secret code</p>
          <p className={styles.code}>{myCode}</p>
          <p className={styles.hint}>Share this with someone to let them add you. Don&apos;t share publicly.</p>
          <button id="regenerate-code" className={styles.dangerBtn} onClick={regenerateCode}>
            🔄 Regenerate code
          </button>
          <p className={styles.warn}>Old code stops working immediately.</p>
        </div>
      )}

      {/* Add contact tab */}
      {tab === "add" && (
        <div className={styles.addTab}>
          <p className={styles.hint}>Enter the secret code shared with you by the other person.</p>
          <input
            id="add-contact-code"
            className={styles.codeInput}
            type="text"
            placeholder="XXXX-XXXXXX"
            value={addCode}
            onChange={e => setAddCode(e.target.value.toUpperCase())}
            autoComplete="off"
            maxLength={12}
          />
          <button id="send-contact-request" className={styles.primaryBtn} onClick={sendRequest}>
            Send request
          </button>
        </div>
      )}

      {/* Requests tab */}
      {tab === "requests" && (
        <div className={styles.requestsTab}>
          {pending.length === 0 && (
            <p className={styles.empty}>No pending requests.</p>
          )}
          {pending.map(r => (
            <div key={r.id} className={styles.requestCard}>
              <div className={styles.requestInfo}>
                <span className={styles.requestId}>User {r.fromUserId.slice(0, 8)}…</span>
                <span className={styles.requestDate}>{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <div className={styles.requestActions}>
                <button id={`reject-${r.id}`} className={styles.rejectBtn} onClick={() => respond(r.id, "reject")}>Reject</button>
                <button id={`accept-${r.id}`} className={styles.acceptBtn} onClick={() => respond(r.id, "accept")}>Accept</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={styles.toast} onAnimationEnd={() => setToast("")} role="status">{toast}</div>
      )}
    </main>
  );
}
