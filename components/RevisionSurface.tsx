"use client";

import { primaryActivitySourceReference } from "@/domain/source-reference";
import { ThemeToggle } from "@/components/ThemeSwitch";
import { ArrowLeft, ArrowOut, Cross, Page, Plus } from "@/components/Marks";
import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MaterialLibrary } from "@/components/MaterialLibrary";
import { CourseSearch } from "@/components/CourseSearch";
import { CourseSourceReader } from "@/components/CourseSourceReader";
import { TodayRoute } from "@/components/TodayRoute";
import { SampleReplaceConfirm } from "@/components/SampleReplaceConfirm";
import { SampleCourseNotice } from "@/components/SampleCourseNotice";
import { setPendingSetupFile } from "@/lib/pending-setup-file";
import { SOURCE_FILE_ACCEPT } from "@/domain/materials";
import { estimatedReadiness } from "@/domain/readiness";
import { TopicMapPanel } from "@/components/TopicMapPanel";
import { ProgressView } from "@/components/ProgressView";
import { AutoStart } from "@/components/AutoStart";
import { PackArt, type PackArtName } from "@/components/PackArt";
import { AppTabBar } from "@/components/AppTabBar";
import { AiSetting } from "@/components/AiConsent";
import { AiPrefetch } from "@/components/AiPrefetch";
import { InlineName } from "@/components/InlineName";
import { ShareProgress } from "@/components/ShareProgress";
import { CourseFolderIcon } from "@/components/CourseFolderIcon";
import { kelusEase } from "@/components/motion";
import { useAuth } from "@/components/AuthProvider";
import { OPEN_SEARCH_EVENT } from "@/components/CommandPalette";
import { BrandIcon, brandForFile } from "@/components/BrandIcon";
import { ConceptDetail } from "@/app/concepts/[id]/ConceptDetail";
import { useDocumentTitle } from "@/lib/use-title";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import { useLearner } from "@/components/LearnerProvider";
import { SAMPLE_COURSE_IDS, sessionContext } from "@/lib/pilot";
import { daysUntilExam } from "@/domain/scheduler";
import { freshOpenSession, restAware, resumeConceptId } from "@/lib/today-focus";
import { generateRoute } from "@/domain/routing-engine";
import { trackEvent } from "@/lib/analytics";
import { getMaterialsSnapshot, getServerMaterialsSnapshot, removeMaterial, subscribeMaterials } from "@/lib/material-store";
import type { LearningSourceReference } from "@/domain/types";
import { removeRemoteMaterial } from "@/lib/material-sync";

export type SurfaceMode = "today" | "materials" | "map" | "progress";

const ALL_MODES: Array<{ id: SurfaceMode; label: string; art: PackArtName; tone: "green" | "marigold" | "iris" }> = [
  { id: "today", label: "Study plan", art: "list-check", tone: "green" },
  { id: "materials", label: "Materials", art: "folder", tone: "marigold" },
  { id: "map", label: "Topics", art: "diagram-project", tone: "iris" },
  { id: "progress", label: "Progress", art: "award", tone: "iris" },
];
/**
 * Each section has one job. Topics is the course index and editor; Progress is the evidence collected while studying.
 * Keeping both visible prevents an otherwise quiet workspace from hiding a core part of the course.
 */
const MODES = ALL_MODES;
const navMode = (mode: SurfaceMode): SurfaceMode => mode;


const pressSpring = { type: "spring", bounce: 0, duration: 0.24 } as const;

function modeFromSection(section: string | null): SurfaceMode {
  if (section === "materials" || section === "map" || section === "progress") return section;
  return "today";
}

function hrefForMode(mode: SurfaceMode, sourceId?: string | null, notesOpen = false, page?: number | null) {
  const params = new URLSearchParams();
  if (mode !== "today") params.set("section", mode);
  if (sourceId) params.set("source", sourceId);
  if (notesOpen) params.set("notes", "1");
  if (page && page > 0) params.set("page", String(page));
  const query = params.toString();
  return query ? `/today?${query}` : "/today";
}

/**
 * Course space as a booklet page.
 * Thin strip for section switching; Today’s topic is the page title.
 */
const noSubscribe = () => () => {};
const searchKeysNow = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K");

/** « to fold the column away, » to bring it back: the sidebar's own control, drawn rather than spelled out. */
function RailChevrons({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={open ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M8 4L4 8l4 4M12.5 4l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RevisionSurface({ topicId }: { /** A topic's own page, opened inside the course workspace (Topics stays selected). */ topicId?: string | null } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion() === true;
  const { state, start, reset, removeMaterialSource, setExamDate, abandon, renameCourse } = useLearner();
  const auth = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const selectedMaterialId = searchParams.get("source");
  const requestedSourcePage = Math.max(1, Number(searchParams.get("page")) || 1);
  const requestedMaterialRole = searchParams.get("add") === "past_exam" ? "past_exam" : searchParams.get("add") === "notes" ? "notes" : undefined;
  const requestedReturn = searchParams.get("returnTo");
  const returnTo = requestedReturn && requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : undefined;
  const sourceBesidePlan = searchParams.get("notes") === "1";
  const [incomingSource, setIncomingSource] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [railHidden, setRailHiddenState] = useState(false);
  const [railAnimated, setRailAnimated] = useState(false);
  const setRailHidden = (hidden: boolean) => { setRailAnimated(true); setRailHiddenState(hidden); };
  const [confirmSourceId, setConfirmSourceId] = useState<string | null>(null);
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourcePickerRef = useRef<HTMLInputElement>(null);
  // Shown only once the browser says which key it is; the server HTML has none, so nothing jumps.
  const searchKeys = useSyncExternalStore(noSubscribe, searchKeysNow, () => "");
  const materials = useSyncExternalStore(subscribeMaterials, getMaterialsSnapshot, getServerMaterialsSnapshot);
  const mode = topicId ? "map" : modeFromSection(searchParams.get("section"));
  // The tab says where you are, like any good app: "Topics · Cell biology — Kelus".
  const tabSection = topicId ? state.snapshot.concepts.find((item) => item.id === topicId)?.name : ALL_MODES.find((item) => item.id === mode)?.label;
  const tabCourse = state.snapshot.courses[0]?.name;
  useDocumentTitle(tabSection ? `${tabSection}${tabCourse ? ` · ${tabCourse}` : ""} — Kelus` : null);

  useEffect(() => {
    document.body.classList.add("is-kelus-space", "is-booklet-page", "is-course-studio");
    return () => document.body.classList.remove("is-kelus-space", "is-booklet-page", "is-course-studio");
  }, []);

  useEffect(() => {
    let shouldFocus = false;
    try {
      shouldFocus = sessionStorage.getItem("kelus-focus-today-start") === "1";
      if (shouldFocus) sessionStorage.removeItem("kelus-focus-today-start");
    } catch {
      shouldFocus = false;
    }
    if (!shouldFocus || mode !== "today") return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>("button.today-start")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const { snapshot, nowIso } = state;
  const course = snapshot.courses[0];
  const exam = snapshot.exams.find((item) => item.courseId === course?.id && item.isActive);

  // Older versions named a course after the first file dropped, even one with no topics in it ("Attestation de
  // stage"). When the name matches none of the notes the topics come from, take the name of the notes that do.
  const namedCourseId = course?.id;
  const courseName = course?.name;
  const topicSources = snapshot.learningActivities
    .filter((activity) => snapshot.concepts.some((concept) => concept.id === activity.conceptId && concept.courseId === namedCourseId))
    .flatMap((activity) => activity.sourceReferences.map((reference) => reference.label).filter((label) => label && label !== "Document outline"));
  const mainSource = [...topicSources.reduce((counts, label) => counts.set(label, (counts.get(label) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];
  const misnamed = Boolean(namedCourseId && courseName && mainSource && !course?.nameSource && namedCourseId !== "course-microeconomics" && courseName !== "My course" && !topicSources.includes(courseName) && !/^pasted notes$/i.test(mainSource));
  useEffect(() => {
    if (misnamed && namedCourseId && mainSource) renameCourse(namedCourseId, mainSource, "repair");
  }, [misnamed, namedCourseId, mainSource, renameCourse]);

  if (!course || !exam) {
    return (
      <main id="main" className="kelus-space is-empty is-paper">
        <section className="materials-empty">
          <h1>Add your course PDF first.</h1>
          <p>Today’s page needs a course and an exam date first.</p>
          <button type="button" className="cta" onClick={() => reset()}>
            Start over
          </button>
        </section>
      </main>
    );
  }

  const concepts = snapshot.concepts.filter((concept) => concept.courseId === course.id);
  const plannedRoute = generateRoute({
    concepts,
    relationships: snapshot.relationships,
    events: snapshot.events,
    exam,
    nowIso,
  });
  // Straight after a block, "Up next" is a topic you have not just answered (the session starts in this order too).
  const route = { ...plannedRoute, allocations: restAware(plannedRoute.allocations, snapshot.events, nowIso, concepts) };
  const days = daysUntilExam(exam, nowIso);
  const examDatePending = Boolean(exam.datePlaceholder);
  const isSampleCourse = SAMPLE_COURSE_IDS.has(course.id) && exam.id === "exam-microeconomics-final";
  const courseId = course.id;
  const examId = exam.id;
  const anyOpenSession = snapshot.sessions.find((session) => session.courseId === courseId && session.status === "in_progress");
  const openSession = freshOpenSession(snapshot.sessions, courseId, nowIso);
  // With a block open, the card names the topic "Continue" will open, never a different one.
  const resumeAllocation = openSession
    ? (() => {
        const conceptId = resumeConceptId(openSession, snapshot.events);
        return route.allocations.find((item) => item.conceptId === conceptId) ?? openSession.latestRoute.allocations.find((item) => item.conceptId === conceptId);
      })()
    : undefined;
  const modeMeta = ALL_MODES.find((item) => item.id === mode)!;
  const courseMaterials = materials.filter((item) => item.courseId === courseId);
  const hasCoursePdf = courseMaterials.some((item) => item.kind === "pdf" && !item.id.startsWith("material-demo-"));
  const firstConceptId = resumeAllocation?.conceptId ?? route.allocations[0]?.conceptId;
  const firstReference = primaryActivitySourceReference(snapshot.learningActivities.find((item) => item.conceptId === firstConceptId));
  const firstSourcePage = Math.max(1, Number(firstReference?.locator?.match(/\d+/)?.[0] ?? 1));
  const preferredMaterial = courseMaterials.find((item) => item.id === firstReference?.materialId);
  const chosenMaterial = courseMaterials.find((item) => item.id === selectedMaterialId);
  const localMaterial = courseMaterials.find((item) => item.storage === "local" && !item.id.startsWith("material-demo-"));
  const selectedMaterial = (mode === "today"
    ? [chosenMaterial, preferredMaterial, localMaterial].find((item) => item?.storage === "local" && !item.id.startsWith("material-demo-"))
    : chosenMaterial ?? preferredMaterial ?? localMaterial)
    ?? courseMaterials[0]
    ?? null;
  const hasReadableSource = selectedMaterial?.storage === "local" && !selectedMaterial.id.startsWith("material-demo-");

  function setMode(next: SurfaceMode) {
    if (next === mode && !topicId) return;
    // A real step in history, so the browser's Back returns to the section you came from.
    router.push(hrefForMode(next, selectedMaterialId, sourceBesidePlan), { scroll: false });
  }

  function openSearchResult(source: LearningSourceReference) {
    const page = Number(source.locator?.match(/\d+/)?.[0] ?? 1);
    router.push(hrefForMode("materials", source.materialId, false, page), { scroll: false });
  }

  function begin() {
    if (anyOpenSession && !openSession) abandon(anyOpenSession.id);
    const sessionId = start(courseId, examId);
    trackEvent({ name: "session_started", session_number: sessionContext({ sessions: snapshot.sessions, nowIso }).session_number, sample: isSampleCourse, course_type: isSampleCourse ? "sample" : "real" });
    try {
      sessionStorage.setItem("kelus-session-before", JSON.stringify(concepts));
    } catch {
      /* Private mode may block sessionStorage; session still starts. */
    }
    router.push(`/session?id=${sessionId}`);
  }

  function resume() {
    if (!openSession) return;
    trackEvent({ name: "session_resumed" });
    router.push(`/session?id=${openSession.id}`);
  }

  async function deleteSource(materialId: string) {
    setRemovingSourceId(materialId);
    setSourceError(null);
    try {
      const material = materials.find((item) => item.id === materialId);
      await removeMaterial(materialId);
      removeMaterialSource(materialId);
      if (selectedMaterialId === materialId) router.replace(hrefForMode(mode, null, sourceBesidePlan), { scroll: false });
      setConfirmSourceId(null);
      if (auth.user) await removeRemoteMaterial(auth.user.id, materialId, material).catch(() => undefined);
    } catch {
      setSourceError("This source could not be removed. Try again.");
    } finally {
      setRemovingSourceId(null);
    }
  }

  return (
    <section className={`kelus-space is-studio${railHidden ? " is-rail-hidden" : ""}${railAnimated ? " is-rail-animated" : ""}`} aria-label="Revision workbench">
      {/* The column stays mounted and folds away, so hiding and showing it glide instead of jumping. */}
      <aside className="studio-rail" aria-label="Course workspace" inert={railHidden} aria-hidden={railHidden || undefined}>
        {/* The mark and the one control that belongs to the column itself, on one row, as in Notion. */}
        <div className="studio-brand-row">
          <Link href="/" className="studio-brand" aria-label="Kelus home">
            <span className="studio-brand-identity"><KelusLogoMark /><strong>kelus</strong></span>
          </Link>
          <span className="studio-brand-theme"><ThemeToggle /></span>
          <button type="button" className="studio-rail-toggle" onClick={(event) => { setRailHidden(true); /* Keyboard users keep their place on the button that brings it back. */ if (event.detail === 0) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".studio-rail-reopen")?.focus({ preventScroll: true })); }} aria-label="Hide workspace sidebar" title="Hide sidebar"><RailChevrons /></button>
        </div>
        <button type="button" className="studio-search" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}>
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          Search
          {searchKeys ? <kbd>{searchKeys}</kbd> : null}
        </button>
        <nav className="studio-nav revision-surface-modes" aria-label="Revision sections">
          {MODES.map((item) => {
            const active = item.id === navMode(mode);
            return (
              <motion.button
                key={item.id}
                type="button"
                data-mode={item.id}
                className={active ? "is-active" : undefined}
                aria-pressed={active}
                aria-label={item.label}
                onClick={() => setMode(item.id)}
                transition={pressSpring}
              >
                <PackArt name={item.art} className="nav-art" />
                {item.label}
              </motion.button>
            );
          })}
        </nav>
        <div className="core-rail-sources">
          <p className="studio-rail-label">Course sources <span>{courseMaterials.length}</span></p>
          {courseMaterials.length ? courseMaterials.map((material) => {
            const title = material.id.startsWith("material-demo-") ? "Built-in Microeconomics example" : material.title;
            const linkedTopics = snapshot.learningActivities.filter((activity) => activity.sourceReferences.some((reference) => reference.materialId === material.id)).length;
            return <div key={material.id} className="core-source-item">
              <button type="button" className={`core-source-open${selectedMaterial?.id === material.id ? " is-selected" : ""}`} onClick={() => {
                const besidePlan = mode === "today" && material.storage === "local" && !window.matchMedia("(max-width: 1120px)").matches;
                router.push(hrefForMode(besidePlan ? "today" : "materials", material.id, besidePlan || sourceBesidePlan), { scroll: false });
              }} title={title}>
                {brandForFile(material.fileName, material.mimeType) ? <BrandIcon brand={brandForFile(material.fileName, material.mimeType)!} size={14} className="core-source-brand" /> : material.storage === "url" ? <ArrowOut /> : <Page />}<span className="core-source-name">{title}</span>
              </button>
              <button type="button" className="core-source-remove" aria-label={`Remove ${title}`} title={`Remove ${title}`} onClick={() => { setSourceError(null); setConfirmSourceId(material.id); }}><Cross size={12} /></button>
              {confirmSourceId === material.id ? <div className="rail-confirm is-source" role="group" aria-label={`Confirm remove ${title}`}>
                <span>{linkedTopics ? `Remove it and its ${linkedTopics} topic${linkedTopics === 1 ? "" : "s"}? Your answers stay in your history.` : "Remove this source?"}</span>
                <span className="rail-confirm-actions">
                  <button type="button" className="k-btn k-btn--paper k-btn--small" onClick={() => setConfirmSourceId(null)} disabled={removingSourceId === material.id}>Keep</button>
                  <button type="button" className="k-btn k-btn--small rail-confirm-yes" onClick={() => void deleteSource(material.id)} disabled={removingSourceId === material.id}>{removingSourceId === material.id ? "Removing…" : "Remove"}</button>
                </span>
              </div> : null}
            </div>;
          }) : <p className="core-rail-empty">Add a PDF to keep it beside your plan.</p>}
          {sourceError ? <p className="core-source-error" role="alert">{sourceError}</p> : null}
          <input
            ref={sourcePickerRef}
            className="sr-only"
            // "＋ Add source" opens it; the hidden field is not a second stop for the keyboard.
            tabIndex={-1}
            title=""
            type="file"
            accept={SOURCE_FILE_ACCEPT}
            aria-label="Choose a course PDF"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setIncomingSource(file);
              setMode("materials");
            }}
          />
          <button type="button" className="core-add-source" onClick={() => sourcePickerRef.current?.click()}><Plus /> Add source</button>
        </div>
        <div className="studio-rail-bottom">
          <ShareProgress variant="rail" />
          <Link href="/" className="studio-home-link"><ArrowLeft /> Back</Link>
          {auth.user ? (
            <button type="button" className="studio-account-action" onClick={() => auth.signOut()}>Sign out</button>
          ) : auth.configured ? (
            <button type="button" className="studio-account-action" onClick={auth.openDialog}>Sign in to sync</button>
          ) : null}
        <details className="studio-more" open={confirmReset || undefined}>
          <summary>Course options</summary>
          {confirmReset ? null : <AiSetting />}
          {confirmReset ? (
            <span className="rail-confirm" role="group" aria-label="Confirm start over">
              <span>Start over? Your topics, answers and plan for this course are erased.</span>
              <span className="rail-confirm-actions">
                <button type="button" className="k-btn k-btn--paper k-btn--small" onClick={() => setConfirmReset(false)}>Keep</button>
                <button type="button" className="k-btn k-btn--small rail-confirm-yes" onClick={() => { setConfirmReset(false); reset(); }}>Start over</button>
              </span>
            </span>
          ) : (
            <button type="button" className="rail-menu-item is-danger" onClick={() => setConfirmReset(true)}>Start over…</button>
          )}
        </details>
        </div>
      </aside>

      <div className="studio-main">
        {/* On a phone the section's name settles into the bar once its big title has scrolled away, as in a native app.
            It is drawn from data-title, so the bar itself stays controls only and the page title stays the one name. */}
        <header className="studio-topbar" data-title={topicId ? undefined : mode === "today" ? courseName ?? modeMeta.label : modeMeta.label}>
          <span className="studio-topbar-leading">{railHidden ? <button type="button" className="studio-rail-reopen" onClick={(event) => { setRailHidden(false); if (event.detail === 0) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".studio-rail-toggle")?.focus({ preventScroll: true })); }} aria-label="Show workspace sidebar" title="Show sidebar"><RailChevrons open /></button> : null}</span>
          {!auth.user && auth.configured ? <button type="button" className="studio-topbar-signin" onClick={auth.openDialog}>Sign in</button> : null}
        </header>
        <main id="main" className="studio-page kelus-space-stage">
        {isSampleCourse ? <SampleCourseNotice showAction /> : null}
        {topicId ? <ConceptDetail conceptId={topicId} embedded /> : null}
        {!topicId && mode !== "today" ? (
          <header className="studio-section-head kelus-paper-head kelus-space-top is-section" data-section={mode}>
            <div className="kelus-space-identity">
              {/* Sections swap at once, as pages do in Notion: no waiting for the old one to leave. */}
              <h1 id="section-title">{modeMeta.label}</h1>
            </div>          </header>
        ) : null}

        {/* The new section is on screen the frame after the click; a short settle of its ink, never an exit to wait for. */}
          {topicId ? null : <motion.div
            key={mode}
            className="studio-panel kelus-paper-body kelus-space-panel revision-surface-panel"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: kelusEase }}
          >
            {mode === "today" ? (
              // Today starts as one focused column. The original notes open beside it only when requested.
              <div className={`core-workspace-grid is-today-single${sourceBesidePlan && hasReadableSource ? " is-notes-open" : ""}`} aria-label="Study plan">
                <div className="core-workspace-action workbench-focus is-ready is-one-next is-booklet-page" aria-labelledby="today-title">
                  {!hasReadableSource && !isSampleCourse ? <p className="core-source-inline">This plan has no original PDF beside it. <Link href="/today?section=materials">Add your course PDF</Link> to study from your own pages.</p> : null}
                  {hasReadableSource && selectedMaterial ? <div className="today-source-access">
                    {/* The file is named only when its name says something the course title does not. */}
                    {selectedMaterial.title.trim().toLocaleLowerCase() !== (courseName ?? "").trim().toLocaleLowerCase() ? <span><Page /> <span title={selectedMaterial.title}>{selectedMaterial.title}</span></span> : <span />}
                    <button type="button" className="today-source-desktop" aria-controls="today-source-reader" aria-expanded={sourceBesidePlan} onClick={() => router.replace(hrefForMode("today", selectedMaterialId, !sourceBesidePlan), { scroll: false })}>{sourceBesidePlan ? "Hide notes" : "See notes beside plan"}</button>
                    <button type="button" className="today-source-mobile" onClick={() => setMode("materials")}>Open notes</button>
                  </div> : null}
                  <AutoStart ready={route.allocations.length > 0} onStart={openSession ? resume : begin} />
                  {/* With smarter questions on, the next topics are written in the background so a session opens at once. */}
                  <AiPrefetch route={route} concepts={concepts} activities={snapshot.learningActivities} />
                  <TodayRoute
                    route={route}
                    concepts={concepts}
                    activities={snapshot.learningActivities}
                    events={snapshot.events}
                    sessions={snapshot.sessions}
                    examTarget={exam.target}
                    targetPercent={exam.targetPercent}
                    daysToExam={days}
                    isSampleCourse={isSampleCourse}
                    hasCoursePdf={hasCoursePdf}
                    examDatePending={examDatePending}
                    onSetExamDate={setExamDate}
                    reminder={{ courseName: course.name, examDate: exam.examDate.slice(0, 10), minutes: exam.availableMinutes }}
                    onStart={openSession ? resume : begin}
                    startLabel={openSession ? "Continue" : undefined}
                    focus={resumeAllocation}
                    relationships={snapshot.relationships}
                    onRenameCourse={isSampleCourse ? undefined : (next) => renameCourse(course.id, next, "user")}
                    onOpenSource={hasReadableSource && selectedMaterial ? () => router.replace(hrefForMode("today", selectedMaterial.id, true), { scroll: false }) : undefined}
                    onOpenNotes={hasReadableSource && selectedMaterial ? () => setMode("materials") : undefined}
                  />
                </div>
                {sourceBesidePlan && hasReadableSource && selectedMaterial ? <CourseSourceReader id="today-source-reader" key={`${selectedMaterial.id}-${selectedMaterial.id === firstReference?.materialId ? firstSourcePage : 1}`} material={selectedMaterial} initialPage={selectedMaterial.id === firstReference?.materialId ? firstSourcePage : 1} /> : null}
              </div>
            ) : null}
            {mode === "materials" ? <div className={`core-workspace-grid is-materials${hasReadableSource ? "" : " is-source-missing"}`}>{hasReadableSource ? <CourseSourceReader key={`${selectedMaterial.id}-${requestedSourcePage}`} material={selectedMaterial} initialPage={requestedSourcePage} /> : null}<div className="core-workspace-action"><CourseSearch concepts={concepts} activities={snapshot.learningActivities.filter((activity) => concepts.some((concept) => concept.id === activity.conceptId))} onOpenSource={openSearchResult} /><MaterialLibrary embedded incomingFile={incomingSource} onIncomingFileHandled={() => setIncomingSource(null)} interceptFile={isSampleCourse ? (file) => { setSampleFile(file); return true; } : undefined} sampleCourse={isSampleCourse} initialRole={requestedMaterialRole} returnTo={returnTo} /></div></div> : null}
            {mode === "map" ? <TopicMapPanel sampleCourse={isSampleCourse} pastPapers={courseMaterials.filter((item) => item.storage === "local" && item.role === "past_exam")} activities={snapshot.learningActivities.filter((activity) => concepts.some((concept) => concept.id === activity.conceptId))} /> : null}
            {mode === "progress" ? <ProgressView concepts={concepts} activities={snapshot.learningActivities} events={snapshot.events} nowIso={nowIso} daysToExam={days} targetPercent={exam.targetPercent} examDatePending={examDatePending} sampleCourse={isSampleCourse} /> : null}
          </motion.div>}
        </main>
        <AppTabBar tabs={MODES} active={navMode(mode)} onSelect={setMode} />
      </div>
      {sampleFile ? (
        <SampleReplaceConfirm
          fileName={sampleFile.name}
          onCancel={() => setSampleFile(null)}
          onConfirm={() => { setPendingSetupFile(sampleFile); setSampleFile(null); reset(); router.push("/today"); }}
        />
      ) : null}
    </section>
  );
}
