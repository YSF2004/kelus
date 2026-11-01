import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const NPM_CI_ARGS = [
  "ci",
  "--no-fund",
  "--fetch-retries=2",
  "--fetch-retry-mintimeout=2000",
  "--fetch-retry-maxtimeout=10000",
  "--fetch-timeout=60000",
];

const transient = /\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ESOCKETTIMEDOUT|ECONNABORTED|EPIPE)\b/;
const permanent = /\b(?:E401|E403|E404|EINTEGRITY|EUSAGE|ERESOLVE|EBADENGINE|ETARGET|ENOTFOUND|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE)\b/;

export function shouldRetryInstall({ status, output, signal }) {
  return status !== 0 && !signal && !permanent.test(output) && transient.test(output);
}

function runNpmCi() {
  return new Promise((done, reject) => {
    const child = spawn("npm", NPM_CI_ARGS, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const capture = (stream) => (chunk) => {
      stream.write(chunk);
      output = (output + chunk.toString()).slice(-65536);
    };
    child.stdout.on("data", capture(process.stdout));
    child.stderr.on("data", capture(process.stderr));
    child.on("error", (error) => reject(new Error(`Could not start npm ci (${error.code ?? "process error"}).`)));
    child.on("close", (status, signal) => done({ status, signal, output }));
  });
}

export async function installLockedDependencies({
  run = runNpmCi,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  progress = (message) => console.error(message),
  attempts = 3,
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) throw new Error("Install attempts must be between 1 and 3.");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await run();
    if (result.status === 0 && !result.signal) return;
    if (!shouldRetryInstall(result)) {
      throw new Error("npm ci failed without a retryable network code. Inspect the original npm error above; lockfile, authorization, integrity, certificate and policy errors are not bypassed.");
    }
    if (attempt === attempts) throw new Error(`npm ci still failed after ${attempts} attempts. Inspect the network error above; dependencies were not changed to work around it.`);
    progress(`[dependencies] Transient npm network failure; retrying locked install (${attempt + 1}/${attempts}).`);
    await sleep(attempt * 10000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await installLockedDependencies();
  } catch (error) {
    console.error(`[dependencies] ${error instanceof Error ? error.message : "Locked install failed."}`);
    process.exitCode = 1;
  }
}
