"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ProductVideoHero.module.css";

// The recording opens on the drop: a student drags their chapter in, so the hero starts at the very beginning.
const WALKTHROUGH_START_SECONDS = 0;

// The five steps of the recording, from its captions (scripts/record-product-hero.mjs prints the times). Each one is a place to jump to, and fills while it plays.
const CHAPTERS = [
  { at: 0, label: "Drop your notes", short: "Drop" },
  { at: 9.3, label: "Read it first", short: "Read" },
  { at: 16, label: "Answer from a line", short: "Answer" },
  { at: 30, label: "Explain, checked", short: "Explain" },
  { at: 45.5, label: "Your plan moves", short: "Plan" },
] as const;

/** Actual browser recordings of a fresh PDF upload and revision session. */
export function HeroProductVideo() {
  const desktop = useRef<HTMLVideoElement>(null);
  const mobile = useRef<HTMLVideoElement>(null);
  const pausedByUser = useRef(false);
  const manuallyPlaying = useRef(false);
  const [playback, setPlayback] = useState<"playing" | "paused" | "ended">("paused");
  const [decodedFrame, setDecodedFrame] = useState({ desktop: false, mobile: false });
  const reduceMotion = useReducedMotion();
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const [chapter, setChapter] = useState(0);

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

  const jumpTo = (index: number) => {
    const video = visibleVideo();
    if (!video) return;
    video.currentTime = CHAPTERS[index].at + 0.05;
    pausedByUser.current = false;
    manuallyPlaying.current = true;
    void video.play().catch(() => setPlayback("paused"));
  };

  // Chapter fills follow the playhead frame by frame (timeupdate alone steps four times a second).
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = [desktop.current, mobile.current].find((item) => item && getComputedStyle(item).display !== "none");
      if (video) {
        const time = video.currentTime;
        const end = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 51;
        CHAPTERS.forEach((item, index) => {
          const next = CHAPTERS[index + 1]?.at ?? end;
          const share = Math.min(1, Math.max(0, (time - item.at) / (next - item.at)));
          const fill = fills.current[index];
          if (fill) fill.style.transform = `scaleX(${share})`;
        });
        const current = CHAPTERS.reduce((found, item, index) => (time >= item.at ? index : found), 0);
        setChapter((previous) => (previous === current ? previous : current));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

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
    <>
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
            <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
            Your browser does not support video playback.
          </video>
        </button>
      </div>
    </figure>
    <ol className={styles.chapters} aria-label="Steps in the walkthrough">
      {CHAPTERS.map((item, index) => (
        <li key={item.at}>
          <button
            type="button"
            className={styles.chapter}
            aria-current={index === chapter ? "step" : undefined}
            aria-label={`Watch step ${index + 1}: ${item.label}`}
            onClick={() => jumpTo(index)}
          >
            <span className={styles.chapterTrack} aria-hidden="true">
              <span ref={(node) => { fills.current[index] = node; }} className={styles.chapterFill} />
            </span>
            <span className={styles.chapterLabel} aria-hidden="true">
              <b>{index + 1}</b> <span className={styles.chapterLong}>{item.label}</span><span className={styles.chapterShort}>{item.short}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
    </>
  );
}
