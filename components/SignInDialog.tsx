"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signin" | "signup" | "reset" | "recovery";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.5 14Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z" />
    </svg>
  );
}

export function SignInDialog() {
  const auth = useAuth();
  const reduceMotion = useReducedMotion() === true;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const { closeDialog, dialogOpen, passwordRecovery } = auth;
  const activeMode: Mode = passwordRecovery ? "recovery" : mode;

  useEffect(() => {
    if (!dialogOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.requestAnimationFrame(() => (passwordRecovery ? passwordRef.current : emailRef.current)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closeDialog, dialogOpen, passwordRecovery]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      if (activeMode === "signin") {
        await auth.signIn(email, password);
      } else if (activeMode === "signup") {
        const verificationRequired = await auth.signUp(name, email, password);
        if (verificationRequired) setMessage("Check your email to verify your Kelus account.");
      } else if (activeMode === "reset") {
        await auth.resetPassword(email);
        setMessage("Check your email for a secure password reset link.");
      } else {
        await auth.updatePassword(password);
      }
    } catch (caught) {
      setIsError(true);
      setMessage(caught instanceof Error ? caught.message : "Kelus could not complete sign in.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) auth.closeDialog();
  }

  return (
    <AnimatePresence>
      {dialogOpen ? (
        <motion.div
          className="auth-backdrop"
          role="presentation"
          onMouseDown={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
        >
          <motion.section
            ref={dialogRef}
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ type: "spring", bounce: 0, duration: reduceMotion ? 0.1 : 0.32 }}
          >
            <button type="button" className="auth-close" onClick={auth.closeDialog} aria-label="Close sign in">
              <span aria-hidden="true">×</span>
            </button>
            <p className="auth-kicker">Your Kelus account</p>
            <h2 id="auth-title">{activeMode === "signin" ? "Welcome back." : activeMode === "signup" ? "Create your account." : activeMode === "reset" ? "Reset your password." : "Choose a new password."}</h2>
            <p className="auth-intro">
              {activeMode === "signin" ? "Return to your study route on this device." : activeMode === "signup" ? "Keep your course and learning evidence with you." : activeMode === "reset" ? "We’ll email you a secure link to continue." : "Use at least eight characters."}
            </p>

            {!auth.configured ? <p className="auth-message is-error" role="alert">Authentication is not configured in this build.</p> : null}

            <form onSubmit={submit}>
              {activeMode === "signup" ? (
                <label>
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                </label>
              ) : null}
              {activeMode !== "recovery" ? <label>Email<input ref={emailRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label> : null}
              {activeMode !== "reset" ? <label>Password<input ref={passwordRef} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={activeMode === "signin" ? "current-password" : "new-password"} minLength={8} required /></label> : null}
              {activeMode === "signin" ? <button type="button" className="auth-forgot" onClick={() => switchMode("reset")}>Forgot password?</button> : null}
              <button type="submit" className="auth-submit" disabled={busy || !auth.configured}>
                {busy ? "Working…" : activeMode === "signin" ? "Sign in" : activeMode === "signup" ? "Create account" : activeMode === "reset" ? "Send reset link" : "Update password"}
                {!busy ? <span aria-hidden="true">→</span> : null}
              </button>
            </form>

            {message ? <p className={`auth-message${isError ? " is-error" : ""}`} role={isError ? "alert" : "status"}>{message}</p> : null}

            {activeMode === "signin" || activeMode === "signup" ? <><div className="auth-divider"><span>or</span></div>
            <button type="button" className="auth-google" disabled={busy || !auth.configured} onClick={() => auth.signInWithGoogle().catch((caught) => {
              setIsError(true);
              setMessage(caught instanceof Error ? caught.message : "Google sign in is unavailable.");
            })}>
              <GoogleMark /> Continue with Google
            </button></> : null}

            <p className="auth-switch">
              {activeMode === "signin" ? "New to Kelus?" : activeMode === "signup" ? "Already have an account?" : activeMode === "reset" ? "Remembered it?" : ""}
              {activeMode !== "recovery" ? <button type="button" onClick={() => switchMode(activeMode === "signin" ? "signup" : "signin")}>
                {activeMode === "signin" ? "Create account" : "Sign in"}
              </button> : null}
            </p>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
