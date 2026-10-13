"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ProductVideoHero.module.css";

// The recording's opening shows the setup screen; the hero begins once the imported course is ready.
const WALKTHROUGH_START_SECONDS = 4;

/** Actual browser recordings of a fresh PDF upload and revision session. */
export function HeroProductVideo() {
  const desktop = useRef<HTMLVideoElement>(null);
  const mobile = useRef<HTMLVideoElement>(null);
  const pausedByUser = useRef(false);
  const manuallyPlaying = useRef(false);
  const [playback, setPlayback] = useState<"playing" | "paused" | "ended">("paused");
  const [decodedFrame, setDecodedFrame] = useState({ desktop: false, mobile: false });
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
    if (video.ended) video.currentTime = WALKTHROUGH_START_SECONDS;
    void video.play().catch(() => setPlayback("paused"));
  };

  useEffect(() => {
    const videos = [desktop.current, mobile.current].filter((video): video is HTMLVideoElement => Boolean(video));
    const motionOff = Boolean(reduceMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const syncPlayback = () => {
      for (const video of videos) {
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) continue;
        if (video.currentTime < WALKTHROUGH_START_SECONDS) {
          video.currentTime = WALKTHROUGH_START_SECONDS;
          continue;
        }
        if (video.seeking) continue;
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
    videos.forEach((video) => {
      observer.observe(video);
      video.addEventListener("loadedmetadata", syncPlayback);
      video.addEventListener("seeked", syncPlayback);
    });
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("resize", syncPlayback);
    syncPlayback();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("resize", syncPlayback);
      videos.forEach((video) => {
        video.removeEventListener("loadedmetadata", syncPlayback);
        video.removeEventListener("seeked", syncPlayback);
        video.pause();
      });
    };
  }, [reduceMotion]);

  return (
    <figure className={styles.videoFigure} aria-label="Kelus product walkthrough: upload a lecture PDF, answer a recall question, and see the study plan respond">
      <div className={styles.videoFrame}>
        <button
          className={styles.videoInteraction}
          type="button"
          onClick={togglePlayback}
          aria-label={`${playback === "playing" ? "Pause" : playback === "ended" ? "Replay" : "Play"} product walkthrough`}
        >
          <video
            ref={desktop}
            className={`${styles.desktopVideo} ${decodedFrame.desktop ? styles.decodedFrame : ""}`}
            muted
            playsInline
            preload="metadata"
            poster="/hero/kelus-product-poster.png"
            aria-hidden="true"
            onPlay={() => { if (visibleVideo() === desktop.current) setPlayback("playing"); }}
            onTimeUpdate={() => {
              if (desktop.current && desktop.current.currentTime > WALKTHROUGH_START_SECONDS + 0.1) {
                setDecodedFrame((frames) => frames.desktop ? frames : { ...frames, desktop: true });
              }
            }}
            onPause={() => { if (visibleVideo() === desktop.current && !desktop.current?.ended) setPlayback("paused"); }}
            onEnded={() => { if (visibleVideo() === desktop.current) setPlayback("ended"); }}
          >
            <source src="/hero/kelus-product-walkthrough.webm" type="video/webm" />
            <source src="/hero/kelus-product-walkthrough.mp4" type="video/mp4" />
            <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
            Your browser does not support video playback.
          </video>
          <video
            ref={mobile}
            className={`${styles.mobileVideo} ${decodedFrame.mobile ? styles.decodedFrame : ""}`}
            muted
            playsInline
            preload="metadata"
            poster="/hero/kelus-product-poster-mobile.png"
            aria-hidden="true"
            onPlay={() => { if (visibleVideo() === mobile.current) setPlayback("playing"); }}
            onTimeUpdate={() => {
              if (mobile.current && mobile.current.currentTime > WALKTHROUGH_START_SECONDS + 0.1) {
                setDecodedFrame((frames) => frames.mobile ? frames : { ...frames, mobile: true });
              }
            }}
            onPause={() => { if (visibleVideo() === mobile.current && !mobile.current?.ended) setPlayback("paused"); }}
            onEnded={() => { if (visibleVideo() === mobile.current) setPlayback("ended"); }}
          >
            <source src="/hero/kelus-product-walkthrough-mobile.webm" type="video/webm" />
            <source src="/hero/kelus-product-walkthrough-mobile.mp4" type="video/mp4" />
            <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
            Your browser does not support video playback.
          </video>
        </button>
      </div>
    </figure>
  );
}
