import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

test("every file the art component points at exists, is a real SVG (or, for the pack's wallpapers, a real PNG), and keeps its source note", () => {
  const source = readFileSync("components/PackArt.tsx", "utf8");
  const paths = [...source.matchAll(/src: "(\/art\/notion-pack\/[^"]+)"/g)].map((match) => match[1]);
  assert.ok(paths.length >= 11);
  for (const path of paths) {
    const file = `public${path}`;
    assert.ok(existsSync(file), `${file} is missing`);
    assert.ok(statSync(file).size > 200, `${file} looks empty`);
    // The drawings are vectors; the pack only ships its wallpapers as images, cut out to transparent PNG.
    if (file.endsWith(".png")) assert.equal(readFileSync(file).subarray(1, 4).toString("latin1"), "PNG", `${file} is not a PNG`);
    else assert.match(readFileSync(file, "utf8"), /<svg[\s>]/);
  }
  // Keep the source and the checked usage terms beside the exported assets.
  const note = readFileSync("public/art/notion-pack/SOURCE.md", "utf8");
  assert.match(note, /Overflow Design/);
  assert.match(note, /https:\/\/www\.overflow\.design\/license\//);
});

test("the art is decorative by default (empty alt, hidden), and named only where it carries a section", () => {
  const source = readFileSync("components/PackArt.tsx", "utf8");
  assert.match(source, /alt=\{label \?\? ""\}/);
  assert.match(source, /aria-hidden=\{label \? undefined : true\}/);
});
