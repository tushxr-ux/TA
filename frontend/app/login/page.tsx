"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message ?? "Login failed");
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
        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.sub}>Sign in to Together</p>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <label className={styles.label}>
          Username
          <input
            id="login-username"
            className={styles.input}
            type="text"
            autoComplete="username"
            required
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          />
        </label>

        <label className={styles.label}>
          Password
          <input
            id="login-password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
        </label>

        <button id="login-submit" className={styles.btn} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className={styles.footer}>
          No account? <Link href="/register" className={styles.link}>Register with invite code</Link>
        </p>
      </form>
    </main>
  );
}
