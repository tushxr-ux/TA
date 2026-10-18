"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [form, setForm] = useState({ inviteCode: "", username: "", displayName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message ?? "Registration failed");
      } else {
        window.location.href = "/chat";
      }
    } catch {
      setError("Network error. Please try again.");
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
