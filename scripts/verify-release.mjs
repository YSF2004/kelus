import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const RELEASE_ROUTES = ["/", "/today/", "/session/", "/session/complete/"];

function positiveInteger(value, name, maximum) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return Number(value);
}

export function parseReleaseOptions(args, env = {}) {
  const options = {
    baseUrl: "https://kelus.me",
    commit: env.GITHUB_SHA || "",
    attempts: 1,
    intervalMs: 15000,
    timeoutMs: 10000,
  };
  const names = { "--url": "baseUrl", "--commit": "commit", "--attempts": "attempts", "--interval-ms": "intervalMs", "--timeout-ms": "timeoutMs" };
  for (let index = 0; index < args.length; index += 2) {
    const key = names[args[index]];
    if (!key || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error("Use --commit SHA, with optional --url, --attempts, --interval-ms and --timeout-ms.");
    }
    options[key] = args[index + 1];
  }
  if (!/^[a-f0-9]{12,40}$/i.test(options.commit)) throw new Error("Provide an explicit release commit of 12–40 hexadecimal characters.");
  const url = new URL(options.baseUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("--url must be an HTTP(S) site origin without credentials, a path, or a query.");
  }
  options.baseUrl = url.origin;
  options.commit = options.commit.toLowerCase().slice(0, 12);
  options.attempts = positiveInteger(options.attempts, "--attempts", 120);
  options.intervalMs = positiveInteger(options.intervalMs, "--interval-ms", 60000);
  options.timeoutMs = positiveInteger(options.timeoutMs, "--timeout-ms", 60000);
  return options;
}

export async function verifyRelease(options, dependencies = {}) {
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  const progress = dependencies.progress ?? (() => {});
  let observed = "unavailable";
  const request = (path) => fetcher(new URL(path, options.baseUrl), {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    let matched = false;
    try {
      const response = await request(`/version.json?release_check=${Date.now()}`);
      if (!response.ok) {
        observed = `HTTP ${response.status}`;
      } else {
        const version = await response.json();
        observed = typeof version.id === "string" && /^[a-f0-9]{12}$/i.test(version.id) ? version.id.toLowerCase() : "invalid version response";
        matched = observed === options.commit;
      }
    } catch {
      observed = "unreachable or invalid version response";
    }
    progress({ attempt, observed, expected: options.commit });
    if (matched) {
      const routes = await Promise.all(RELEASE_ROUTES.map(async (path) => {
        const response = await request(path);
        if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
        if (!response.headers.get("content-type")?.includes("text/html")) throw new Error(`${path} did not return an HTML page.`);
        const body = await response.text();
        if (!/<html(?:\s|>)/i.test(body)) throw new Error(`${path} returned an invalid HTML page.`);
        return path;
      }));
      return { commit: options.commit, baseUrl: options.baseUrl, routes };
    }
    if (attempt < options.attempts) await sleep(options.intervalMs);
  }
  throw new Error(`Production release not verified: expected ${options.commit}, observed ${observed}. Check the production workflow; a GitHub push alone is not a deployment.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseReleaseOptions(process.argv.slice(2), process.env);
    const result = await verifyRelease(options, {
      progress: ({ attempt, expected, observed }) => console.log(`[release ${attempt}/${options.attempts}] expected=${expected} live=${observed}`),
    });
    console.log(`[release] VERIFIED ${result.commit} on ${result.baseUrl}; ${result.routes.length} public pages responded with HTML.`);
    console.log("[release] HTTP checks do not establish that sign-in, sync, imports, or evidence navigation work. Complete the browser smoke check.");
  } catch (error) {
    console.error(`[release] ${error instanceof Error ? error.message : "Verification failed."}`);
    process.exitCode = 1;
  }
}
