"use client";
import { useEffect } from "react";
import styles from "./Toast.module.css";

export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
