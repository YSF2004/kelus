"use client";

import { useEffect } from "react";

/**
 * Where Android sends a file shared to Kelus. The service worker answers that request and opens Today; this page is
 * only reached without one (an old install), and goes straight to Today.
 */
export default function ShareTarget() {
  useEffect(() => { window.location.replace("/today/"); }, []);
  return (
    <main id="main" className="destination-page">
      <h1 className="destination-page-title" role="status">Opening Kelus…</h1>
    </main>
  );
}
