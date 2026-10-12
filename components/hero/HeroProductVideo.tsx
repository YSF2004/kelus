"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ProductVideoHero.module.css";

/** Actual browser recordings of a fresh PDF upload and revision session. */
export function HeroProductVideo() {
  const desktop = useRef<HTMLVideoElement>(null);
  const mobile = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const videos = [desktop.current, mobile.current].filter((video): video is HTMLVideoElement => Boolean(video));
    const motionOff = Boolean(reduceMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const syncPlayback = () => {
      for (const video of videos) {
        const active = getComputedStyle(video).display !== "none"
          && video.getBoundingClientRect().top < window.innerHeight * 0.8
          && video.getBoundingClientRect().bottom > window.innerHeight * 0.2;
        if (motionOff || document.hidden || !active) {
          video.pause();
        } else if (!video.ended && video.paused) {
          void video.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
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
    <figure className={styles.videoFigure} aria-describedby="kelus-video-description">
      <div className={styles.videoFrame}>
        <video
          ref={desktop}
          className={styles.desktopVideo}
          controls
          muted
          playsInline
          preload="metadata"
          poster="/hero/kelus-product-poster.png"
          aria-label="Watch Kelus turn an uploaded lecture PDF into a study plan"
        >
          <source src="/hero/kelus-product-walkthrough.mp4" type="video/mp4" />
          <source src="/hero/kelus-product-walkthrough.webm" type="video/webm" />
          <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
          Your browser does not support video playback.
        </video>
        <video
          ref={mobile}
          className={styles.mobileVideo}
          controls
          muted
          playsInline
          preload="metadata"
          poster="/hero/kelus-product-poster-mobile.png"
          aria-label="Watch Kelus turn an uploaded lecture PDF into a study plan on a phone"
        >
          <source src="/hero/kelus-product-walkthrough-mobile.mp4" type="video/mp4" />
          <source src="/hero/kelus-product-walkthrough-mobile.webm" type="video/webm" />
          <track src="/hero/kelus-product-walkthrough.vtt" kind="captions" srcLang="en" label="Walkthrough steps" />
          Your browser does not support video playback.
        </video>
      </div>
      <figcaption className={styles.videoCaption} id="kelus-video-description">
        Recorded in Kelus with a demo lecture PDF. Upload, answer, then see the study plan respond.
      </figcaption>
    </figure>
  );
}
