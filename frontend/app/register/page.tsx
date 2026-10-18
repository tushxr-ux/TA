"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ inviteCode: "", username: "", displayName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("access_token")) {
      router.replace("/chat");
    }
  }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(data?.message)
          ? data.message.join(", ")
          : data?.message || data?.error?.message || "Registration failed";
        setError(msg);
      } else {
        if (data?.access_token) {
          localStorage.setItem("access_token", data.access_token);
        }
        if (data?.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token);
        }
        window.location.href = "/chat";
      }
    } catch (err: any) {
      setError(err?.message ? `Network error: ${err.message}` : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.glow} aria-hidden />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Create account</h1>
        <p className={styles.sub}>You need an invite code to join</p>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {[
          { id: "reg-invite", label: "Invite code", key: "inviteCode" as const, type: "text", autocomplete: "off" },
          { id: "reg-username", label: "Username", key: "username" as const, type: "text", autocomplete: "username" },
          { id: "reg-name", label: "Display name", key: "displayName" as const, type: "text", autocomplete: "name" },
          { id: "reg-password", label: "Password", key: "password" as const, type: "password", autocomplete: "new-password" },
        ].map(f => (
          <label key={f.key} className={styles.label}>
            {f.label}
            <input
              id={f.id}
              className={styles.input}
              type={f.type}
              autoComplete={f.autocomplete}
              required
              value={form[f.key]}
              onChange={set(f.key)}
            />
          </label>
        ))}

        <button id="register-submit" className={styles.btn} type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>

        <p className={styles.footer}>
          Already have an account? <Link href="/login" className={styles.link}>Sign in</Link>
        </p>
      </form>
    </main>
  );
}
