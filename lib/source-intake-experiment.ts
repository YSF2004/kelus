/**
 * A small, anonymous first-use experiment. It only changes the explanation
 * around the source picker; the file handling and study path stay identical.
 * The assignment is stored on-device so a returning student never sees the
 * wording change beneath them.
 */
export type SourceIntakeVariant = "reference" | "course_story";

const STORAGE_KEY = "kelus-source-intake-variant";

export function getSourceIntakeVariant(storage: Pick<Storage, "getItem" | "setItem"> | null = typeof window === "undefined" ? null : window.localStorage, random = Math.random): SourceIntakeVariant {
  if (!storage) return "reference";
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved === "reference" || saved === "course_story") return saved;

    const assigned: SourceIntakeVariant = random() < 0.5 ? "reference" : "course_story";
    storage.setItem(STORAGE_KEY, assigned);
    return assigned;
  } catch {
    // Storage can be unavailable in a private browser. The default preserves
    // the original, concise source picker without interrupting study.
    return "reference";
  }
}
