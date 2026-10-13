"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ProductVideoHero.module.css";

/** Actual browser recordings of a fresh PDF upload and revision session. */
export function HeroProductVideo() {
  const desktop = useRef<HTMLVideoElement>(null);
  const mobile = useRef<HTMLVideoElement>(null);
  const pausedByUser = useRef(false);
  const manuallyPlaying = useRef(false);
  const [playback, setPlayback] = useState<"playing" | "paused" | "ended">("paused");
  const reduceMotion = useReducedMotion();

  const visibleVideo = () => [desktop.current, mobile.current].find(
    (video) => video && getComputedStyle(video).display !== "none",
  );

  const togglePlayback = () => {
    const video = visibleVideo();
    if (!video) return;
    if (!video.paused) {
      pausedByUser.current = true;
      manuallyPlaying.current = false;
      video.pause();
      return;
    }
    pausedByUser.current = false;
    manuallyPlaying.current = true;
    if (video.ended) video.currentTime = 0;
    void video.play().catch(() => setPlayback("paused"));
  };

  useEffect(() => {
    const videos = [desktop.current, mobile.current].filter((video): video is HTMLVideoElement => Boolean(video));
    const motionOff = Boolean(reduceMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const syncPlayback = () => {
      for (const video of videos) {
        const active = getComputedStyle(video).display !== "none"
          && video.getBoundingClientRect().top < window.innerHeight * 0.8
          && video.getBoundingClientRect().bottom > window.innerHeight * 0.2;
        if (document.hidden || !active || pausedByUser.current || (motionOff && !manuallyPlaying.current)) {
          video.pause();
        } else if (!video.ended && video.paused) {
          void video.play().catch(() => setPlayback("paused"));
        }
      }
    };
    const observer = new IntersectionObserver(syncPlayback, { threshold: [0, 0.2, 0.8] });
    videos.forEach((video) => observer.observe(video));
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("resize", syncPlayback);
    syncPlayback();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("resize", syncPlayback);
      videos.forEach((video) => video.pause());
    };
  }, [reduceMotion]);

  return (
    <figure className={styles.videoFigure} aria-label="Kelus product walkthrough: upload a lecture PDF, answer a recall question, and see the study plan respond">
      <div className={styles.videoFrame}>
        <video
          ref={desktop}
          className={styles.desktopVideo}
          muted
          playsInline
          preload="metadata"
          poster="/hero/kelus-product-poster.png"
          aria-label="Watch Kelus turn an uploaded lecture PDF into a study plan"
          onPlay={() => { if (visibleVideo() === desktop.current) setPlayback("playing"); }}
          onPause={() => { if (visibleVideo() === desktop.current && !desktop.current?.ended) setPlayback("paused"); }}
          onEnded={() => { if (visibleVideo() === desktop.current) setPlayback("ended"); }}
        >
          <source src="/hero/kelus-product-walkthrough.mp4" type="video/mp4" />
          <source src="/hero/kelus-product-walkthrough.webm" type="video/webm" />
          <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
          Your browser does not support video playback.
        </video>
        <video
          ref={mobile}
          className={styles.mobileVideo}
          muted
          playsInline
          preload="metadata"
          poster="/hero/kelus-product-poster-mobile.png"
          aria-label="Watch Kelus turn an uploaded lecture PDF into a study plan on a phone"
          onPlay={() => { if (visibleVideo() === mobile.current) setPlayback("playing"); }}
          onPause={() => { if (visibleVideo() === mobile.current && !mobile.current?.ended) setPlayback("paused"); }}
          onEnded={() => { if (visibleVideo() === mobile.current) setPlayback("ended"); }}
        >
          <source src="/hero/kelus-product-walkthrough-mobile.mp4" type="video/mp4" />
          <source src="/hero/kelus-product-walkthrough-mobile.webm" type="video/webm" />
          <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
          Your browser does not support video playback.
        </video>
        <button className={styles.playbackButton} type="button" onClick={togglePlayback} aria-label={`${playback === "playing" ? "Pause" : playback === "ended" ? "Replay" : "Play"} video`}>
          {playback === "playing" ? (
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="3" height="12" rx="1" /><rect x="12" y="4" width="3" height="12" rx="1" /></svg>
          ) : playback === "ended" ? (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 6a7 7 0 1 0 1 6" /><path d="M16 2v4h-4" /></svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 3.8a1 1 0 0 1 1.5-.86l9 6.2a1 1 0 0 1 0 1.72l-9 6.2A1 1 0 0 1 6 16.2V3.8Z" /></svg>
          )}
        </button>
      </div>
    </figure>
  );
}
