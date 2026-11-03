"use client";

import { useEffect } from "react";
import { listenForInstall, runningAsApp } from "@/lib/install-app";

/**
 * Runs once on every page: registers the worker that makes Kelus open offline and instantly in production (and in
 * the explicit Playwright opt-in), catches the browser's install offer, and marks installed-app mode for the layout.
 */
export function AppRuntime() {
  useEffect(() => {
    listenForInstall();
    if (runningAsApp()) document.documentElement.classList.add("is-installed-app");
    const e2eServiceWorker = process.env.NEXT_PUBLIC_E2E_SERVICE_WORKER === "1";
    if ((process.env.NODE_ENV !== "production" && !e2eServiceWorker) || !("serviceWorker" in navigator)) return;
    const register = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined); };
    // After the page has settled, so registering never competes with the first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
