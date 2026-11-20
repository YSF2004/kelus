"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { useLearner } from "@/components/LearnerProvider";
import { rankItems, type SearchItem as Item } from "@/lib/search-rank";
import styles from "./CommandPalette.module.css";

/** Anything in the app can open search with this event, e.g. the sidebar's Search row. */
export const OPEN_SEARCH_EVENT = "kelus:open-search";

const PRODUCT_PATHS = ["/today", "/concept", "/concepts", "/map", "/materials", "/session/complete"];


const SECTIONS: Item[] = [
  { id: "go-plan", group: "Go to", label: "Study plan", href: "/today" },
  { id: "go-topics", group: "Go to", label: "Topics", href: "/today?section=map" },
  { id: "go-materials", group: "Go to", label: "Materials", detail: "Add notes or a PDF", href: "/today?section=materials" },
  { id: "go-progress", group: "Go to", label: "Progress", href: "/today?section=progress" },
];

function status(mastery: number, attempts: number) {
  if (!attempts) return "Not started";
  const percent = Math.round(mastery * 100);
  if (attempts < 3) return `${percent >= 80 ? "Solid" : "Needs work"} · ${attempts} ${attempts === 1 ? "try" : "tries"}`;
  return percent >= 80 ? `Solid · ${percent}%` : `Needs work · ${percent}%`;
}

/**
 * ⌘K (Ctrl+K): jump to any topic or section by typing a few letters, as in Notion. Arrow keys move, Enter opens,
 * Escape closes. Lives over every product screen.
 */
export function CommandPalette() {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion() === true;
  const { state } = useLearner();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const enabled = PRODUCT_PATHS.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (!enabled) return;
    const show = () => { setQuery(""); setActive(0); setOpen(true); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        if (open) setOpen(false); else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_SEARCH_EVENT, show); };
  }, [enabled, open]);

  const items = useMemo(() => {
    const course = state.snapshot.courses[0];
    const topics: Item[] = state.snapshot.concepts
      .filter((concept) => !course || concept.courseId === course.id)
      .map((concept) => ({ id: concept.id, group: "Topics", label: concept.name, detail: status(concept.mastery, concept.retrievalAttempts), href: `/concept?id=${encodeURIComponent(concept.id)}` }));
    return [...topics, ...SECTIONS];
  }, [state.snapshot.concepts, state.snapshot.courses]);

  const results = useMemo(() => rankItems(items, query), [items, query]);
  const current = Math.min(active, Math.max(0, results.length - 1));

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current + 1) % Math.max(1, results.length)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current - 1 + results.length) % Math.max(1, results.length)); }
    else if (event.key === "Enter") { event.preventDefault(); go(results[current]); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  if (!enabled) return null;

  let lastGroup = "";
  return (
    <ModalOverlay isOpen={open} isDismissable onOpenChange={setOpen} className={styles.scrim}>
      <Modal className={styles.box}>
        <Dialog aria-label="Search your course" className={styles.dialog}>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.field}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <input
                id="kelus-search-input"
                autoFocus
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search topics and sections"
                aria-label="Search topics and sections"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={results.length ? `${listId}-${current}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className={styles.esc}>Esc</kbd>
            </div>
            <ul id={listId} role="listbox" className={styles.list} aria-label="Results">
              {results.length ? results.map((item, index) => {
                const heading = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li key={item.id} role="presentation">
                    {heading ? <p className={styles.group} aria-hidden="true">{heading}</p> : null}
                    <div
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === current}
                      className={styles.option}
                      onPointerMove={() => { if (index !== current) setActive(index); }}
                      onClick={() => go(item)}
                    >
                      <span className={styles.label}>{item.label}</span>
                      {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
                      <span className={styles.enter} aria-hidden="true">↵</span>
                    </div>
                  </li>
                );
              }) : <li className={styles.empty} role="presentation">No topic or section called “{query.trim()}”.</li>}
            </ul>
          </motion.div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
