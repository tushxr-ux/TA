import styles from "./page.module.css";
import Link from "next/link";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.card}>
        <div className={styles.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="Together" width={72} height={72} className={styles.logoImg} />
        </div>
        <h1 className={styles.title}>Together</h1>
        <p className={styles.tagline}>Private. Just the two of you.</p>

        <div className={styles.actions}>
          <Link href="/login" className={styles.btnPrimary} id="go-to-login">
            Sign in
          </Link>
          <Link href="/register" className={styles.btnSecondary} id="go-to-register">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
