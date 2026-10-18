"use client";
import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import styles from "./InstallBanner.module.css";

export default function InstallBanner() {
  const { isInstallable, isIOS, isStandalone, triggerInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true); // start hidden, reveal after check

  useEffect(() => {
    const d = localStorage.getItem("install-dismissed");
    if (!d) setDismissed(false);
  }, []);

  const dismiss = () => {
    localStorage.setItem("install-dismissed", "1");
    setDismissed(true);
  };

  // Already installed or explicitly dismissed — show nothing
  if (isStandalone || dismissed) return null;
  // Not installable on Android and not iOS — show nothing
  if (!isInstallable && !isIOS) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Install app">
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.iconWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="Together app icon" width={64} height={64} className={styles.icon} />
        </div>

        <h2 className={styles.title}>Add Together to your home screen</h2>
        <p className={styles.sub}>
          {isIOS
            ? `Tap the share button below, then tap "Add to Home Screen".`
            : "Install the app for the best experience — works offline and feels native."}
        </p>

        {isIOS ? (
          <div className={styles.iosSteps}>
            <Step icon="⬆️" text='Tap the Share icon at the bottom of Safari' />
            <Step icon="➕" text='"Add to Home Screen"' />
            <Step icon="✅" text="Tap Add — done!" />
          </div>
        ) : (
          <button className={styles.installBtn} onClick={triggerInstall} id="install-app-btn">
            Install App
          </button>
        )}

        <button className={styles.dismissBtn} onClick={dismiss} id="install-dismiss-btn">
          Maybe later
        </button>
      </div>
    </div>
  );
}

function Step({ icon, text }: { icon: string; text: string }) {
  return (
    <div className={styles.step}>
      <span className={styles.stepIcon}>{icon}</span>
      <span className={styles.stepText}>{text}</span>
    </div>
  );
}
