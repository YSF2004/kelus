import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const statuses = new Set(["unknown", "documented", "observed"]);
const kinds = new Set(["official-doc", "browser", "student-study"]);
const day = 86_400_000;
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
function date(value) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), "Use YYYY-MM-DD dates");
  const parsed = Date.parse(`${value}T00:00:00Z`);
  requireValue(Number.isFinite(parsed) && new Date(parsed).toISOString().startsWith(value), "Invalid date");
  return parsed;
}

export function evaluateBenchmark(data, asOf = new Date().toISOString().slice(0, 10)) {
  const now = date(asOf);
  requireValue(data.version === 1, "Unsupported benchmark version");
  requireValue(Number.isInteger(data.maxEvidenceAgeDays) && data.maxEvidenceAgeDays > 0, "Invalid evidence age");
  requireValue(Array.isArray(data.criteria) && data.criteria.length > 0, "Missing criteria");
  const criteria = new Map();
  for (const criterion of data.criteria) {
    requireValue(typeof criterion.id === "string" && !criteria.has(criterion.id), "Duplicate or invalid criterion");
    requireValue(typeof criterion.label === "string" && Number.isFinite(criterion.weight) && criterion.weight > 0, "Invalid criterion weight/label");
    requireValue(typeof criterion.critical === "boolean", "Criterion needs a critical flag");
    criteria.set(criterion.id, criterion);
  }
  requireValue([...criteria.values()].reduce((sum, item) => sum + item.weight, 0) === 100, "Weights must total 100");
  const evidence = new Map();
  for (const item of data.evidence ?? []) {
    requireValue(typeof item.id === "string" && !evidence.has(item.id), "Duplicate or invalid evidence");
    requireValue(kinds.has(item.kind) && typeof item.location === "string" && item.location.trim().length > 0, "Evidence needs kind and location");
    const age = (now - date(item.reviewedAt)) / day;
    requireValue(age >= 0, "Future evidence is not valid");
    evidence.set(item.id, { ...item, fresh: age <= data.maxEvidenceAgeDays });
  }
  requireValue(Array.isArray(data.products) && data.products.length >= 2, "Compare at least two products");
  const names = new Set();
  const products = data.products.map((product) => {
    requireValue(typeof product.name === "string" && !names.has(product.name), "Duplicate or invalid product");
    names.add(product.name);
    const assessments = new Map();
    for (const item of product.assessments ?? []) {
      requireValue(criteria.has(item.criterion) && !assessments.has(item.criterion), "Unknown or duplicate assessment");
      requireValue(statuses.has(item.status) && typeof item.note === "string", "Invalid assessment status/note");
      requireValue(Array.isArray(item.evidence), "Assessment needs evidence references");
      const refs = item.evidence.map((id) => {
        requireValue(evidence.has(id), `Unknown evidence: ${id}`);
        return evidence.get(id);
      });
      if (item.status === "observed") {
        requireValue(Number.isInteger(item.rating) && item.rating >= 0 && item.rating <= 4, "Observed ratings must be integers 0–4");
        requireValue(["sample", "standard"].includes(item.scope), "Observed rating needs sample or standard scope");
        requireValue(refs.some((ref) => ref.kind !== "official-doc"), "Official claims cannot establish observed quality");
        if (item.rating === 4) requireValue(refs.some((ref) => ref.kind === "student-study"), "Exceptional ratings require student-study evidence");
      } else {
        requireValue(item.rating === null, "Do not score unobserved experiences");
        if (item.status === "documented") requireValue(refs.length > 0, "Documented claims need evidence");
      }
      assessments.set(item.criterion, { ...item, fresh: refs.length > 0 && refs.every((ref) => ref.fresh) });
    }
    const rows = [...criteria.values()].map((criterion) => {
      const item = assessments.get(criterion.id) ?? { status: "unknown", rating: null, evidence: [], note: "Not assessed", fresh: false };
      return { ...criterion, ...item, eligible: item.status === "observed" && item.scope === "standard" && item.fresh };
    });
    const coverage = rows.reduce((sum, row) => sum + (row.eligible ? row.weight : 0), 0);
    const score = coverage === 100 ? rows.reduce((sum, row) => sum + row.weight * row.rating / 40, 0) : null;
    const blockers = rows.filter((row) => row.critical && (!row.eligible || row.rating < 3)).map((row) => row.label);
    return { name: product.name, rows, coverage, score, blockers, ready: score !== null && score >= 8.5 && blockers.length === 0 };
  });
  return { asOf, products, evidence: [...evidence.values()] };
}

const cell = (value) => String(value).replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
export function renderBenchmark(result) {
  const lines = [
    "# Kelus product benchmark", "", `Reviewed as of ${result.asOf}. Internal working evidence, not marketing claims.`,
    "Scores require fresh, hands-on results on the full standard protocol. Sample-only tests and official claims cannot establish an overall score.",
    "", "| Product | Standard evidence coverage | Overall /10 | Benchmark target |",
    "| --- | ---: | ---: | --- |",
  ];
  for (const product of result.products) {
    lines.push(`| ${cell(product.name)} | ${product.coverage}% | ${product.score === null ? "Not established" : product.score.toFixed(1)} | ${product.ready ? "Met" : "Not established / below target"} |`);
  }
  for (const product of result.products) {
    lines.push("", `## ${cell(product.name)}`, "", "| Dimension | Weight | Evidence status | Local rating /4 | Observation |", "| --- | ---: | --- | ---: | --- |");
    for (const row of product.rows) {
      lines.push(`| ${cell(row.label)} | ${row.weight}% | ${row.status}${row.scope ? ` (${row.scope})` : ""}${row.evidence.length && !row.fresh ? " — STALE" : ""} | ${row.rating ?? "—"} | ${cell(row.note)} ${row.evidence.map((id) => `[${cell(id)}]`).join(" ")} |`);
    }
    lines.push("", `Critical dimensions needing evidence or improvement: ${product.blockers.join("; ") || "None"}.`);
  }
  lines.push("", "## Evidence");
  for (const item of result.evidence) lines.push(`- **${cell(item.id)}** (${item.kind}, reviewed ${item.reviewedAt}${item.fresh ? "" : ", STALE"}): ${cell(item.location)}`);
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    requireValue(args.filter((arg) => arg !== "--strict").length <= 1, "Usage: node scripts/product-benchmark.mjs [scorecard.json] [--strict]");
    const input = args.find((arg) => arg !== "--strict");
    const data = JSON.parse(readFileSync(input ?? new URL("../docs/product-benchmark/scorecard.json", import.meta.url), "utf8"));
    const result = evaluateBenchmark(data);
    process.stdout.write(renderBenchmark(result));
    if (args.includes("--strict")) process.exitCode = result.products.find((product) => product.name === "Kelus")?.ready ? 0 : 1;
  } catch (error) {
    console.error(`Benchmark error: ${error.message}`);
    process.exitCode = 1;
  }
}
