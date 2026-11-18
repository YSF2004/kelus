"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DropNotes } from "@/components/DropNotes";
import { MaterialLibrary } from "@/components/MaterialLibrary";
import { RevisionSurface } from "@/components/RevisionSurface";
import { useLearner } from "@/components/LearnerProvider";
import { getAcquisitionSource, startFirstQuestionTimer, trackEvent } from "@/lib/analytics";
import styles from "./loading.module.css";
import { addSourceMaterial, getMaterialsSnapshot, getServerMaterialsSnapshot, removeMaterial, subscribeMaterials } from "@/lib/material-store";
import { removeRemoteMaterial, uploadMaterialPdf } from "@/lib/material-sync";
import { useAuth } from "@/components/AuthProvider";
import { CURRENT_COURSE_ID, type SetupInput } from "@/lib/setup";
import { takeSharedFileOnce } from "@/lib/shared-file";
import { setPendingSetupFile } from "@/lib/pending-setup-file";

const SAMPLE_COURSE_ID = "course-microeconomics";
const SAMPLE_SESSION_KEY = "kelus-sample-open";
import type { LearnerSnapshot } from "@/domain/types";

function BuildingPlan({ snapshot, onReady }: { snapshot: LearnerSnapshot; onReady: (input: Parameters<ReturnType<typeof useLearner>["completeDiagnosis"]>[0]) => void }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const top = [...snapshot.concepts].sort((a, b) => b.examImportance - a.examImportance || a.name.localeCompare(b.name)).slice(0, 3);
    onReady({ ratings: Object.fromEntries(top.map((concept) => [concept.id, "dont_know" as const])), retrievals: [] });
    // Runs once when the topics are confirmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main id="main" className="destination-page">
      <h1 className="destination-page-title" role="status">Building your plan…</h1>
    </main>
  );
}

function TodayBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, completeSetup, completeDiagnosis, removeMaterialSource, useDemo: loadDemo } = useLearner();
  const auth = useAuth();
  const materials = useSyncExternalStore(subscribeMaterials, getMaterialsSnapshot, getServerMaterialsSnapshot);
  const notesSource = materials.find((item) => item.storage === "local")?.kind === "text";
  const sampleHandled = useRef(false);
  const wantsSample = searchParams.get("sample") === "1";
  const acquisitionSource = searchParams.get("source");
  // The built-in sample is only ever shown in the browser session that asked for it (?sample=1). Saved or synced
  // from an older visit, it is not the learner's course, so Today starts them on their own notes instead.
  const [sampleOpened] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (wantsSample) window.sessionStorage.setItem(SAMPLE_SESSION_KEY, "1");
      return window.sessionStorage.getItem(SAMPLE_SESSION_KEY) === "1";
    } catch { return wantsSample; }
  });
  const sampleBooting = wantsSample && !state.onboardingCompleted;
  // A file shared from another app (Android share sheet): read from this device, then handed to the add-notes screen
  // as if it had been dropped there; the hand-off can be taken once, so a screen that remounts never imports it twice.
  // Until it is read, Today says it is opening the file.
  const [sharedIntoCourse, setSharedIntoCourse] = useState(false);
  const [openingShare, setOpeningShare] = useState(() => searchParams.get("shared") === "1");
  // Keep the controlled source-page label for this browser session so an upload,
  // topic review, and first route can be attributed to the landing page that led here.
  useEffect(() => {
    if (!acquisitionSource || !/^[a-z0-9-]{2,64}$/.test(acquisitionSource)) return;
    try { window.sessionStorage.setItem("kelus-acquisition-source", acquisitionSource); } catch { /* Attribution is optional. */ }
  }, [acquisitionSource]);
  useEffect(() => {
    if (!openingShare) return;
    let live = true;
    void takeSharedFileOnce().then((file) => {
      if (!live) return;
      // Where it goes is decided now, from the courses that existed before the share: into that course, or, with
      // none yet, as the first course. Deciding later would see the course this very file creates.
      const intoExisting = state.onboardingCompleted && state.snapshot.concepts.length > 0 && state.snapshot.courses[0]?.id !== SAMPLE_COURSE_ID;
      if (file) { setPendingSetupFile(file); setSharedIntoCourse(intoExisting); trackEvent({ name: "material_shared_in", kind: file.type || "unknown" }); }
      setOpeningShare(false);
      // The link is spent: drop ?shared without a navigation, which would remount the screen holding the file.
      window.history.replaceState(window.history.state, "", "/today/");
    });
    return () => { live = false; };
    // Runs once, when Today opens on a share: the courses it reads are the ones from before that share, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingShare]);

  useEffect(() => {
    if (!wantsSample) return;
    if (sampleHandled.current) return;
    sampleHandled.current = true;
    const alreadyReady = state.onboardingCompleted && state.snapshot.concepts.length > 0;
    if (!alreadyReady) {
      loadDemo();
      trackEvent({ name: "sample_loaded", source: "today_query" });
    }
    router.replace("/today");
  }, [wantsSample, state.onboardingCompleted, state.snapshot.concepts.length, loadDemo, router]);

  function finishDiagnosis(input: Parameters<typeof completeDiagnosis>[0]) {
    completeDiagnosis(input);
    try {
      sessionStorage.setItem("kelus-focus-today-start", "1");
    } catch {
      /* Focus handoff is optional. */
    }
    let elapsedMs = 0;
    try {
      const startedAt = Number(window.localStorage.getItem("kelus-first-route-started-at"));
      elapsedMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
      window.localStorage.removeItem("kelus-first-route-started-at");
    } catch {
      elapsedMs = 0;
    }
    trackEvent({ name: "first_route_ready", elapsed_ms: elapsedMs, concept_count: state.snapshot.concepts.length, course_type: state.snapshot.courses[0]?.id === SAMPLE_COURSE_ID ? "sample" : "real", acquisition_source: getAcquisitionSource() });
  }

  const roleFor = (file: File) => (/syllabus|outline/i.test(file.name) ? "syllabus" : /slides|lecture/i.test(file.name) ? "lecture_slides" : "notes");

  /** The very first notes: make the course with sensible defaults and read the file. The exam date is asked after the first run. */
  async function startFromFile(file: File) {
    const role = roleFor(file);
    const acquisitionSource = getAcquisitionSource();
    trackEvent({ name: "material_upload_started", role, course_type: "real", acquisition_source: acquisitionSource });
    try { window.localStorage.setItem("kelus-first-route-started-at", String(Date.now())); } catch { /* Timing analytics are optional. */ }
    startFirstQuestionTimer();
    const examDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const input: SetupInput = {
      // Named only once a file is shown to hold topics (see MaterialLibrary): an unreadable or unrelated file
      // ("Attestation de stage") must never become the course's name.
      courseName: "My course",
      examName: "Your exam",
      examDate,
      targetPercent: 85,
      availableMinutes: 30,
      examDatePlaceholder: true,
    };
    try {
      const material = await addSourceMaterial({ courseId: CURRENT_COURSE_ID, file, role });
      trackEvent({ name: "material_upload_completed", role, course_type: "real", acquisition_source: acquisitionSource });
      if (auth.user) void uploadMaterialPdf(auth.user.id, material, file).catch(() => undefined);
    } catch (error) {
      trackEvent({ name: "material_upload_failed", role, course_type: "real", acquisition_source: acquisitionSource });
      throw error;
    }
    try { sessionStorage.setItem("kelus-start-first-run", "1"); } catch { /* Without it the learner lands on Today instead. */ }
    completeSetup(input);
  }

  // A course that exists but has no notes yet (after starting over) uploads here; it is counted like a first upload.
  async function addNotes(file: File, courseId: string) {
    const role = roleFor(file);
    const acquisitionSource = getAcquisitionSource();
    trackEvent({ name: "material_upload_started", role, course_type: "real", acquisition_source: acquisitionSource });
    let material;
    try {
      material = await addSourceMaterial({ courseId, file, role });
      trackEvent({ name: "material_upload_completed", role, course_type: "real", acquisition_source: acquisitionSource });
    } catch (error) {
      trackEvent({ name: "material_upload_failed", role, course_type: "real", acquisition_source: acquisitionSource });
      throw error;
    }
    if (auth.user) void uploadMaterialPdf(auth.user.id, material, file).catch(() => undefined);
    try { sessionStorage.setItem("kelus-start-first-run", "1"); } catch { /* Without it the learner lands on Today instead. */ }
  }

  /** A file with nothing readable in it: remove it (and anything half-made) so the start screen comes back clean. */
  async function startOver(materialIds: string[]) {
    for (const id of materialIds) {
      const material = materials.find((item) => item.id === id);
      await removeMaterial(id).catch(() => undefined);
      removeMaterialSource(id);
      if (auth.user) await removeRemoteMaterial(auth.user.id, id, material).catch(() => undefined);
    }
  }

  if (openingShare) {
    return (
      <main id="main" className="destination-page">
        <h1 className="destination-page-title" role="status">Opening your file…</h1>
      </main>
    );
  }

  // Shared into a course that already has topics: the same add-notes screen, already holding the file, and the
  // materials section once it is in.
  if (sharedIntoCourse && state.onboardingCompleted && state.snapshot.concepts.length && state.snapshot.courses[0]?.id !== SAMPLE_COURSE_ID) {
    const course = state.snapshot.courses[0];
    return (
      <DropNotes
        courseName={course?.name}
        onFile={async (file) => {
          await addNotes(file, course?.id ?? CURRENT_COURSE_ID);
          setSharedIntoCourse(false);
          router.push("/today?section=materials");
        }}
      />
    );
  }

  if (sampleBooting) {
    return (
      <main id="main" className="destination-page">
        <p className="destination-brand">Kelus</p>
        <h1 className="destination-page-title">Loading sample…</h1>
        <p>Opening the course preview.</p>
      </main>
    );
  }

  if (!state.onboardingCompleted) {
    return <DropNotes first onFile={startFromFile} />;
  }

  if (state.snapshot.courses[0]?.id === SAMPLE_COURSE_ID && !sampleOpened && !wantsSample) {
    return <DropNotes first onFile={startFromFile} />;
  }

  if (!state.snapshot.concepts.length) {
    const course = state.snapshot.courses[0];
    const local = materials.filter((item) => item.storage === "local");
    if (!local.length) {
      // No topics and no notes: the same single screen as the very first one. A leftover built-in sample is not
      // the learner's course, so it never names the page or receives their notes: they start their own.
      const leftoverSample = course?.id === SAMPLE_COURSE_ID;
      if (leftoverSample) return <DropNotes first onFile={startFromFile} />;
      // A course without a single topic has nothing of its own yet, not even a name worth showing.
      return <DropNotes first onFile={(file) => addNotes(file, course?.id ?? CURRENT_COURSE_ID)} />;
    }
    return (
      <main id="main" className="destination-page start-page">
        <MaterialLibrary embedded quiet onStartOver={() => void startOver(local.filter((item) => item.processingStatus === "failed").map((item) => item.id))} />
      </main>
    );
  }

  if (!state.diagnosisCompleted) {
    // No rating screen: topics start as "new", and your first answers set the route.
    return <BuildingPlan snapshot={state.snapshot} onReady={finishDiagnosis} />;
  }

  return <RevisionSurface />;
}


export default function TodayPage() {
  return (
    <Suspense
      fallback={
        // The shape of the workspace, drawn quietly while it loads: nothing jumps when the real page arrives.
        <main id="main" className={styles.loading}>
          <h1 className="sr-only" role="status">Opening your study plan…</h1>
          <div className={styles.rail} aria-hidden="true"><i className={styles.brand} /><i /><i /><i /><i /></div>
          <div className={styles.stage} aria-hidden="true">
            <i className={styles.line} />
            <div className={styles.card}><i className={styles.kicker} /><i className={styles.title} /><i className={styles.text} /><i className={styles.button} /></div>
            <i className={styles.row} /><i className={styles.row} />
          </div>
        </main>
      }
    >
      <TodayBody />
    </Suspense>
  );
}
