const STORAGE_KEY = "kelus:waitlist:v1";

export type WaitlistEntry = {
  email: string;
  source: string;
  note?: string;
  createdAt: string;
};

/** Signups always have somewhere to go: the list service when one is set, else the Questions inbox. */
export function waitlistEndpointConfigured() {
  return true;
}

function readEntries(): WaitlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as WaitlistEntry[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: WaitlistEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-100)));
  } catch {
    // Waitlist capture must never break the page.
  }
}

export function normalizeWaitlistEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidWaitlistEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeWaitlistEmail(email));
}

export async function submitWaitlistSignup(input: {
  email: string;
  source?: string;
  note?: string;
}): Promise<
  | { ok: true; duplicate?: boolean; delivery: "remote" | "local" }
  | { ok: false; error: string }
> {
  const email = normalizeWaitlistEmail(input.email);
  if (!isValidWaitlistEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const entry: WaitlistEntry = {
    email,
    source: input.source?.trim() || "waitlist",
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const existing = readEntries();
  const duplicate = existing.some((item) => item.email === email);
  if (!duplicate) writeEntries([...existing, entry]);

  const endpoint = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT?.trim();
  if (!endpoint) {
    // No list service: the signup goes to the same inbox as Questions (hello@kelus.me), so it reaches a person instead
    // of sitting in this browser. It is still kept here, and never claimed as delivered when it was not.
    const { submitClientQuestion } = await import("./questions");
    const sent = await submitClientQuestion({
      name: "Waitlist signup",
      email,
      question: `Please add me to the Kelus waitlist.${entry.note ? ` Studying: ${entry.note}` : ""}`,
      source: `waitlist:${entry.source}`,
    });
    return { ok: true, duplicate, delivery: sent.ok && sent.delivery === "remote" ? "remote" : "local" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: entry.email,
        source: entry.source,
        note: entry.note,
        createdAt: entry.createdAt,
      }),
      keepalive: true,
    });
    if (!response.ok) {
      // Local copy already saved — stay honest that remote delivery failed.
      return { ok: true, duplicate, delivery: "local" };
    }
  } catch {
    return { ok: true, duplicate, delivery: "local" };
  }

  return { ok: true, duplicate, delivery: "remote" };
}

export function readWaitlistEntries() {
  return readEntries();
}

export function exportWaitlistCsv(entries = readEntries()) {
  const header = "email,source,note,createdAt";
  const rows = entries.map((entry) =>
    [entry.email, entry.source, entry.note ?? "", entry.createdAt]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

export function downloadWaitlistCsv(filename = `kelus-waitlist-${new Date().toISOString().slice(0, 10)}.csv`) {
  if (typeof document === "undefined") return 0;
  const entries = readEntries();
  if (!entries.length) return 0;
  const blob = new Blob([exportWaitlistCsv(entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return entries.length;
}
