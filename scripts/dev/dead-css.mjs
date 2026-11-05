// Finds global CSS rules that can never match: a selector naming a class that appears nowhere in the app's code.
// Conservative: a class built from a template prefix ("is-${…}") counts as used, as does any attribute selector.
// Usage: node scripts/dev/dead-css.mjs [--write]   (prints a report; --write removes the dead selectors/rules)
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const roots = ["app", "components", "lib", "domain", "data", "public"];
const exts = /\.(tsx?|mjs|js|json|html|svg|md)$/;
const files = [];
const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (exts.test(entry.name)) files.push(full); } };
for (const root of roots) if (fs.existsSync(root)) walk(root);
const corpus = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const prefixes = [...new Set([...corpus.matchAll(/([a-z][a-z0-9-]*-)\$\{/g)].map((m) => m[1]))];
const known = new Map();
const used = (cls) => {
  if (known.has(cls)) return known.get(cls);
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hit = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(corpus) || prefixes.some((prefix) => cls.startsWith(prefix));
  known.set(cls, hit);
  return hit;
};

/**
 * A selector can never match when one of its own parts names an unused class. Inside :is(), :where(), :has() and
 * :matches() it is dead only if every alternative is; a class inside :not() never kills it (the :not then always holds).
 */
function isDead(selector) {
  let dead = false;
  selector.each((node) => {
    if (dead) return;
    if (node.type === "class" && !used(node.value)) dead = true;
    else if (node.type === "pseudo" && /^:(?:is|where|has|matches|-webkit-any)$/i.test(node.value) && node.nodes.length) {
      if (node.nodes.every((inner) => isDead(inner))) dead = true;
    }
  });
  return dead;
}

const write = process.argv.includes("--write");
// kelus-system.css is the documented system (design.md): its pieces are kept for the screens that will use them.
const cssFiles = fs.readdirSync("app").filter((name) => name.endsWith(".css") && name !== "kelus-system.css").map((name) => path.join("app", name));
let totalBefore = 0, totalAfter = 0, rulesRemoved = 0, selectorsRemoved = 0;
const report = [];
for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  totalBefore += source.length;
  const root = postcss.parse(source, { from: file });
  let fileRules = 0;
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    let keep = [];
    try {
      selectorParser((selectors) => {
        selectors.each((selector) => {
          if (isDead(selector)) { selectorsRemoved += 1; report.push(`${file}: ${selector.toString().trim()}`); } else keep.push(selector.toString().trim());
        });
      }).processSync(rule.selector);
    } catch { return; }
    if (!keep.length) { rule.remove(); rulesRemoved += 1; fileRules += 1; }
    else if (keep.length !== rule.selectors.length) rule.selector = keep.join(",\n");
  });
  // An @media or @supports left with nothing inside goes too.
  root.walkAtRules((at) => { if (/^(media|supports|layer|container)$/.test(at.name) && at.nodes && !at.nodes.some((node) => node.type !== "comment")) at.remove(); });
  const out = root.toString();
  totalAfter += out.length;
  if (write && out !== source) fs.writeFileSync(file, out);
  if (fileRules) console.error(`${file}: ${fileRules} rules removed`);
}
fs.writeFileSync(process.env.REPORT ?? "/dev/null", report.join("\n"));
console.log(`selectors dead: ${selectorsRemoved}, rules removed: ${rulesRemoved}, bytes ${totalBefore} → ${totalAfter} (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`);
