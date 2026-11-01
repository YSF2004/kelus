import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { installLockedDependencies, NPM_CI_ARGS, shouldRetryInstall } from "../scripts/install-ci.mjs";

const failure = (output, signal = null) => ({ status: 1, output, signal });
const success = { status: 0, output: "", signal: null };

test("both workflows and the existing direct shipping script use the install guard", () => {
  for (const path of [".github/workflows/deploy.yml", ".github/workflows/verify-pr.yml", "scripts/ship.sh"]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /node scripts\/install-ci\.mjs/);
  }
});

test("CI continues using npm ci and bounded network fetch settings", () => {
  assert.equal(NPM_CI_ARGS[0], "ci");
  assert.ok(NPM_CI_ARGS.includes("--fetch-timeout=60000"));
  assert.ok(NPM_CI_ARGS.includes("--fetch-retries=2"));
  assert.doesNotMatch(NPM_CI_ARGS.join(" "), /legacy-peer-deps|--force|strict-ssl|--registry|ignore-scripts/);
});

test("only recognized temporary network codes cause retries", () => {
  for (const code of ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"]) {
    assert.equal(shouldRetryInstall(failure(`npm error code ${code}`)), true);
  }
  assert.equal(shouldRetryInstall(failure("npm error network Check your proxy settings.")), false);
  assert.equal(shouldRetryInstall({ ...failure("ECONNRESET"), status: 0 }), false);
});

test("lockfile, permissions, integrity, policy and certificate failures remain fatal", () => {
  for (const code of ["EUSAGE", "ERESOLVE", "E401", "E403", "EINTEGRITY", "ETARGET", "EBADENGINE", "CERT_HAS_EXPIRED"]) {
    assert.equal(shouldRetryInstall(failure(`npm error code ${code}`)), false);
    assert.equal(shouldRetryInstall(failure(`ECONNRESET earlier; npm error code ${code}`)), false);
  }
  assert.equal(shouldRetryInstall(failure("ECONNRESET", "SIGTERM")), false);
});

test("successful installs are not repeated", async () => {
  let count = 0;
  await installLockedDependencies({ run: async () => { count += 1; return success; } });
  assert.equal(count, 1);
});

test("a temporary failure retries the locked install and can recover", async () => {
  let count = 0;
  const delays = [];
  await installLockedDependencies({
    run: async () => ++count === 1 ? failure("npm error code ECONNRESET") : success,
    sleep: async (ms) => { delays.push(ms); },
    progress: () => {},
  });
  assert.equal(count, 2);
  assert.deepEqual(delays, [10000]);
});

test("persistent network errors stop after three attempts", async () => {
  let count = 0;
  await assert.rejects(installLockedDependencies({
    run: async () => { count += 1; return failure("npm error code ETIMEDOUT"); },
    sleep: async () => {},
    progress: () => {},
  }), /after 3 attempts/);
  assert.equal(count, 3);
});

test("permanent or unknown failures stop on the first attempt", async () => {
  for (const output of ["npm error code EUSAGE", "npm error code E403", "npm error unknown failure"]) {
    let count = 0;
    await assert.rejects(installLockedDependencies({
      run: async () => { count += 1; return failure(output); },
      sleep: async () => { assert.fail("A permanent error must not retry."); },
    }), /without a retryable network code/);
    assert.equal(count, 1);
  }
});
