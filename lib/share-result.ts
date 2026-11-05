/**
 * A session's result, made to be shared: the numbers only, never a line of the notes. The course is named in the
 * message and picture only when the student named it, and never in the link. The link opens /r with the same
 * numbers, so a friend sees the card, and carries UTM tags so arrivals from it can be counted.
 */

export type ResultStats = {
  /** The course name the student chose, or null for the default "My course". */
  course: string | null;
  /** Lines answered right in this session. */
  recalled: number;
  /** Lines missed in this session: they come back in tomorrow's warm-up. */
  missed: number;
  topics: number;
  /** Lines recalled across the whole course, and how many lines it has. */
  courseRecalled: number;
  courseTotal: number;
  streak: number;
};

export const SHARE_URL = "https://kelus.me/r/";

/** The link for this result: /r with its numbers only (no course, no notes), tagged for analytics. */
export function shareUrl(stats: ResultStats, origin = "https://kelus.me") {
  const query = new URLSearchParams({
    l: String(stats.recalled), m: String(stats.missed), t: String(stats.topics),
    c: String(stats.courseRecalled), of: String(stats.courseTotal), s: String(stats.streak),
    utm_source: "share", utm_medium: "result", utm_campaign: "session",
  });
  return `${origin}/r/?${query}`;
}

/** The numbers back out of a shared link, each a small whole number, or null when the link is not a result. */
export function statsFromQuery(query: URLSearchParams): ResultStats | null {
  const n = (key: string) => {
    const value = Number(query.get(key));
    return Number.isInteger(value) && value >= 0 && value <= 10_000 ? value : null;
  };
  const [recalled, missed, topics, courseRecalled, courseTotal, streak] = ["l", "m", "t", "c", "of", "s"].map(n);
  if (recalled === null || missed === null || topics === null || courseRecalled === null || courseTotal === null || streak === null) return null;
  if (courseRecalled > courseTotal || recalled + missed + topics === 0) return null;
  return { course: null, recalled, missed, topics, courseRecalled, courseTotal, streak };
}

/** A link straight into WhatsApp with the message and link filled in, for the group chats many classes run on. */
export function whatsappUrl(stats: ResultStats) {
  return `https://wa.me/?text=${encodeURIComponent(`${shareText(stats)} ${shareUrl(stats)}`)}`;
}

/**
 * The one number the card leads with, chosen so it is worth sending (as Duolingo's and Strava's cards lead with the
 * stat a learner is proud of): lines recalled when there are any, else the lines practiced, else the topics.
 */
export function leadStat(stats: ResultStats): { value: number; of: number | null; what: string } {
  const asked = stats.recalled + stats.missed;
  if (stats.recalled > 0) return { value: stats.recalled, of: asked, what: "lines recalled from my notes" };
  if (asked > 0) return { value: asked, of: null, what: asked === 1 ? "line practiced from my notes" : "lines practiced from my notes" };
  return { value: stats.topics, of: null, what: stats.topics === 1 ? "topic practiced" : "topics practiced" };
}

export function shareHeadline(stats: ResultStats) {
  const asked = stats.recalled + stats.missed;
  if (stats.recalled > 0) return `${stats.recalled} of ${asked} lines recalled`;
  return asked ? `${asked} ${asked === 1 ? "line" : "lines"} practiced` : `${stats.topics} ${stats.topics === 1 ? "topic" : "topics"} practiced`;
}

/** The message that goes with the link: what happened, in plain words, and why a friend might care. */
export function shareText(stats: ResultStats) {
  const from = stats.course ? ` from ${stats.course}` : " from my notes";
  const asked = stats.recalled + stats.missed;
  const today = stats.recalled > 0 ? `I recalled ${stats.recalled} of ${asked} lines${from} today` : asked ? `I practiced ${asked} ${asked === 1 ? "line" : "lines"}${from} today` : `I practiced ${stats.topics} ${stats.topics === 1 ? "topic" : "topics"}${from} today`;
  const back = stats.missed ? `, and the ${stats.missed === 1 ? "one" : stats.missed} I missed ${stats.missed === 1 ? "comes" : "come"} back tomorrow` : "";
  const streak = stats.streak > 1 ? ` (${stats.streak}-day streak)` : "";
  return `${today}${back}${streak}. Kelus turns your own notes into questions:`;
}

/** The family a CSS variable resolves to, so the drawn card uses the page's own fonts. */
function family(variable: string, fallback: string) {
  const probe = document.createElement("span");
  probe.style.fontFamily = `var(${variable}), ${fallback}`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).fontFamily;
  probe.remove();
  return resolved || fallback;
}

/**
 * The same card as a 1080×1350 picture (a portrait post), for a share sheet that takes images: paper, the result in
 * the book serif, the course's numbers, and kelus.me. Drawn on a canvas so nothing leaves the device to make it.
 */
export async function drawResultCard(stats: ResultStats): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const serif = family("--font-source-serif", "Georgia, serif");
  const sans = family("--font-inter", "system-ui, sans-serif");
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const ink = "#1a1915";
  const muted = "#5e5b53";
  const green = "#1f6b45";
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, 1080, 1350);
  // A sheet of paper on the desk, with a hairline.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e8e4db";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(72, 72, 936, 1206, 36);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = green;
  ctx.font = `700 30px ${sans}`;
  ctx.letterSpacing = "4px";
  ctx.fillText((stats.course ?? "Today's revision").toUpperCase().slice(0, 34), 150, 220);
  ctx.letterSpacing = "0px";

  const lead = leadStat(stats);
  ctx.fillStyle = ink;
  ctx.font = `600 260px ${serif}`;
  const big = String(lead.value);
  ctx.fillText(big, 140, 520);
  const bigWidth = ctx.measureText(big).width;
  ctx.fillStyle = muted;
  ctx.font = `400 120px ${serif}`;
  if (lead.of !== null) ctx.fillText(`/${lead.of}`, 150 + bigWidth, 520);
  ctx.fillStyle = ink;
  ctx.font = `500 54px ${sans}`;
  ctx.fillText(lead.what, 150, 610);

  // Three small figures under a rule, the way a report card closes.
  ctx.fillStyle = "#e8e4db";
  ctx.fillRect(150, 700, 780, 2);
  const figures: Array<[string, string]> = [
    [String(stats.missed), "back tomorrow"],
    [`${stats.courseRecalled}/${stats.courseTotal}`, "in the course"],
    [String(Math.max(1, stats.streak)), "day streak"],
  ];
  figures.forEach(([value, label], index) => {
    const x = 150 + index * 270;
    ctx.fillStyle = ink;
    ctx.font = `600 84px ${serif}`;
    ctx.fillText(value, x, 820);
    ctx.fillStyle = muted;
    ctx.font = `400 34px ${sans}`;
    ctx.fillText(label, x, 872);
  });

  ctx.fillStyle = muted;
  ctx.font = `400 38px ${sans}`;
  ctx.fillText("Every question came from my own notes.", 150, 1040);
  ctx.fillStyle = ink;
  ctx.font = `700 52px ${sans}`;
  ctx.fillText("kelus.me", 150, 1180);
  ctx.fillStyle = green;
  ctx.beginPath();
  ctx.arc(930 - 18, 1164, 18, 0, Math.PI * 2);
  ctx.fill();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
