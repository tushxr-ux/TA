"use client";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import styles from "./DeleteRangeSheet.module.css";

interface Props {
  conversationId: string;
  onClose: () => void;
  onDeleted: (result: { deletedCount: number; freedBytes: number; keptMedia: boolean }) => void;
}

type SizeResult = { count: number; bytes: number } | null;

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DeleteRangeSheet({ conversationId, onClose, onDeleted }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const [size, setSize] = useState<SizeResult>(null);
  const [loadingSize, setLoadingSize] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [keepMedia, setKeepMedia] = useState(true);

  async function fetchSize() {
    if (!from || !to) return;
    setLoadingSize(true);
    try {
      const res = await fetch(
        `${API_URL}/conversations/${conversationId}/messages/size?from=${from}&to=${to}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setSize(data);
    } finally {
      setLoadingSize(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_URL}/conversations/${conversationId}/messages?from=${from}&to=${to}&deleteMedia=${!keepMedia}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      onDeleted({ ...data, keptMedia: keepMedia });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Delete messages">
      <div className={styles.sheet}>
        <div className={styles.handle} />
        <h2 className={styles.title}>Delete messages</h2>
        <p className={styles.sub}>Choose a date range to delete</p>

        {/* Date range */}
        <div className={styles.dateRow}>
          <label className={styles.dateLabel}>
            From
            <input
              id="delete-from-date"
              className={styles.dateInput}
              type="date"
              max={to || today}
              value={from}
              onChange={e => { setFrom(e.target.value); setSize(null); }}
            />
          </label>
          <label className={styles.dateLabel}>
            To
            <input
              id="delete-to-date"
              className={styles.dateInput}
              type="date"
              min={from}
              max={today}
              value={to}
              onChange={e => { setTo(e.target.value); setSize(null); }}
            />
          </label>
        </div>

        {/* Estimate button */}
        {from && to && !size && (
          <button
            id="delete-check-size"
            className={styles.sizeBtn}
            onClick={fetchSize}
            disabled={loadingSize}
          >
            {loadingSize ? "Checking…" : "Check storage"}
          </button>
        )}

        {/* Storage estimate */}
        {size && (
          <div className={styles.estimate}>
            <span className={styles.estimateCount}>{size.count} messages</span>
            <span className={styles.estimateDot}>·</span>
            <span className={styles.estimateSize}>{formatBytes(size.bytes)}</span>
          </div>
        )}

        {/* Media toggle */}
        {size && (
          <div className={styles.mediaToggle}>
            <div className={styles.mediaToggleText}>
              <span className={styles.mediaToggleTitle}>Keep media files</span>
              <span className={styles.mediaToggleSub}>Images &amp; voice notes stay; only messages are removed</span>
            </div>
            <button
              id="delete-keep-media-toggle"
              className={`${styles.toggle} ${keepMedia ? styles.toggleOn : ""}`}
              role="switch"
              aria-checked={keepMedia}
              onClick={() => setKeepMedia(v => !v)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button id="delete-cancel" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            id="delete-confirm"
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={!from || !to || !size || deleting}
          >
            {deleting ? "Deleting…" : keepMedia ? "Delete messages" : "Delete everything"}
          </button>
        </div>
      </div>
    </div>
  );
}
