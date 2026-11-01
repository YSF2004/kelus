import assert from "node:assert/strict";
import test from "node:test";
import { parseReleaseOptions, RELEASE_ROUTES, verifyRelease } from "../scripts/verify-release.mjs";
import { checkProductionConfig } from "../scripts/check-production-config.mjs";

const commit = "123456abcdef".repeat(3) + "1234";
const options = () => parseReleaseOptions(["--commit", commit, "--attempts", "2", "--interval-ms", "1"]);
const html = () => new Response("<!doctype html><html><body>Kelus</body></html>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
const valid = () => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_public_key_only",
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-EXAMPLE123",
});

test("release verification requires an explicit commit and bounded request settings", () => {
  assert.throws(() => parseReleaseOptions([]), /explicit release commit/);
  assert.throws(() => parseReleaseOptions(["--commit", commit, "--attempts", "0"]), /integer/);
  assert.throws(() => parseReleaseOptions(["--commit", commit, "--url", "https://user:password@example.com"]), /without credentials/);
  assert.throws(() => parseReleaseOptions(["--commit", commit, "--unknown", "x"]), /Use --commit/);
  assert.equal(parseReleaseOptions([], { GITHUB_SHA: commit }).commit, commit.slice(0, 12));
});

test("a matching version verifies real HTML routes without executing browser analytics", async () => {
  const calls = [];
  const result = await verifyRelease(options(), {
    fetch: async (url, init) => {
      calls.push(url.pathname);
      assert.equal(init.cache, "no-store");
      return url.pathname === "/version.json" ? Response.json({ id: commit.slice(0, 12) }) : html();
    },
  });
  assert.equal(result.commit, commit.slice(0, 12));
  assert.deepEqual(result.routes, RELEASE_ROUTES);
  assert.deepEqual(calls, ["/version.json", ...RELEASE_ROUTES]);
});

test("a stale release is retried but never presented as successfully deployed", async () => {
  const seen = [];
  await assert.rejects(verifyRelease(options(), {
    fetch: async () => Response.json({ id: "abcdef123456" }),
    sleep: async () => {},
    progress: (event) => seen.push(event),
  }), /expected 123456abcdef, observed abcdef123456/);
  assert.equal(seen.length, 2);
});

test("a delayed matching release succeeds after retry", async () => {
  let versions = 0;
  const result = await verifyRelease(options(), {
    fetch: async (url) => url.pathname === "/version.json"
      ? Response.json({ id: ++versions === 1 ? "abcdef123456" : commit.slice(0, 12) }) : html(),
    sleep: async () => {},
  });
  assert.equal(result.commit, commit.slice(0, 12));
  assert.equal(versions, 2);
});

test("unreachable and malformed release endpoints cannot count as a release", async () => {
  for (const fetch of [
    async () => { throw new Error("network unavailable"); },
    async () => new Response("not json"),
    async () => Response.json({ id: "<html>not a commit</html>" }),
    async () => new Response("unavailable", { status: 503 }),
  ]) {
    await assert.rejects(verifyRelease(options(), { fetch, sleep: async () => {} }), /not verified/);
  }
});

test("a matching version with a broken or non-HTML page fails verification", async () => {
  for (const broken of [() => new Response("", { status: 500 }), () => Response.json({ ok: true }), () => new Response("not HTML", { headers: { "Content-Type": "text/html" } })]) {
    await assert.rejects(verifyRelease(options(), {
      fetch: async (url) => url.pathname === "/version.json" ? Response.json({ id: commit.slice(0, 12) }) : broken(),
    }), /returned HTTP|HTML/);
  }
});

test("production authentication accepts public project configuration and custom HTTPS origins", () => {
  assert.equal(checkProductionConfig(valid()).ok, true);
  assert.equal(checkProductionConfig({ ...valid(), NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.edu" }).ok, true);
  const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
  assert.equal(checkProductionConfig({ ...valid(), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `header.${payload}.signature` }).ok, true);
});

test("production checks reject missing, dashboard, REST, and unsafe authentication settings", () => {
  assert.equal(checkProductionConfig({}).ok, false);
  for (const url of ["https://supabase.com/dashboard/project/example", "https://example.supabase.co/rest/v1", "http://example.supabase.co", "https://name:password@example.supabase.co"]) {
    assert.equal(checkProductionConfig({ ...valid(), NEXT_PUBLIC_SUPABASE_URL: url }).ok, false);
  }
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  for (const key of ["https://example.supabase.co/rest/v1", "sb_secret_not_a_public_key", `header.${payload}.signature`]) {
    assert.equal(checkProductionConfig({ ...valid(), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }).ok, false);
  }
});

test("optional public integrations are validated without printing their values", () => {
  const result = checkProductionConfig({ ...valid(), NEXT_PUBLIC_AI_ENDPOINT: "http://insecure.example.test", NEXT_PUBLIC_GA_MEASUREMENT_ID: "" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /NEXT_PUBLIC_AI_ENDPOINT/);
  assert.doesNotMatch(result.errors.join(" "), /insecure\.example/);
  assert.match(result.warnings.join(" "), /do not claim/);
  assert.equal(checkProductionConfig({ ...valid(), NEXT_PUBLIC_AI_ENDPOINT: "/api/questions" }).ok, true);
});
