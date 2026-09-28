/**
 * One-command end-to-end verification.
 *
 * Builds the static export, serves `out/` with the zero-dependency server, runs
 * the browser harness and the design QA, then shuts everything down. Nothing
 * here is required by the product — it exists so the evidence in
 * `docs/VERIFICATION.md` can be reproduced with a single command.
 *
 *   npm run verify:e2e
 *
 * Environment:
 *   PORT         port for the static server (default 4173, first free one wins)
 *   SKIP_BUILD   set to 1 to reuse an existing `out/`
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const START_PORT = Number(process.env.PORT ?? 4173);

const C = {
  reset: "\x1b[0m",
  step: "\x1b[36m",
  pass: "\x1b[32m",
  fail: "\x1b[31m",
};

function portIsFree(port) {
  return new Promise((resolveFree) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    const finish = (free) => {
      socket.destroy();
      resolveFree(free);
    };
    socket.once("connect", () => finish(false));
    socket.once("error", () => finish(true));
    socket.setTimeout(500, () => finish(true));
  });
}

async function firstFreePort(start) {
  for (let port = start; port < start + 20; port += 1) {
    if (await portIsFree(port)) return port;
  }
  throw new Error(`no free port in ${START_PORT}..${START_PORT + 20}`);
}

async function waitForServer(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  return false;
}

function step(label, args, env = {}) {
  process.stdout.write(`\n${C.step}▸ ${label}${C.reset}\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status ?? "signal"})`);
}

async function main() {
  if (process.env.SKIP_BUILD === "1") {
    if (!existsSync(resolve(ROOT, "out/index.html"))) {
      throw new Error("SKIP_BUILD=1 but out/index.html does not exist");
    }
    process.stdout.write(`\n${C.step}▸ reusing existing out/${C.reset}\n`);
  } else {
    step("next build (static export)", ["node_modules/next/dist/bin/next", "build"]);
  }

  const port = await firstFreePort(START_PORT);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
    env: { ...process.env, PORT: String(port) },
  });

  let failure = null;
  try {
    if (!(await waitForServer(baseUrl))) {
      throw new Error(`static server did not answer on ${baseUrl}`);
    }
    process.stdout.write(`\n${C.step}▸ serving ${baseUrl}${C.reset}\n`);

    step("browser harness — A4, print CSS, one page, a11y, responsive", [
      "scripts/verify-print.mjs",
    ], { BASE_URL: baseUrl });

    step("design QA — contrast, type scale, hierarchy, rhythm", ["scripts/design-qa.mjs"], {
      BASE_URL: baseUrl,
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }

  if (failure) {
    process.stderr.write(`\n${C.fail}verification failed: ${failure.message}${C.reset}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\n${C.pass}All verification steps passed.${C.reset}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`\n${C.fail}${error.message}${C.reset}\n`);
  process.exitCode = 1;
}
