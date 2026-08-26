#!/usr/bin/env node
/**
 * wait-for-server.mjs — block until a TCP port accepts a connection, then
 * optionally open it in the default browser.
 *
 * This exists because `start-site.bat` needs to open a browser *after* the dev
 * server is listening, and the usual batch-file answer to that is `timeout /t 3`.
 * A fixed sleep is wrong in both directions: on a cold start with an antivirus
 * scanning node.exe it is too short and the browser lands on a connection error,
 * and on a warm start it is three seconds of nothing. Polling the port takes as
 * long as it takes and no longer.
 *
 * It probes rather than fetches: a TCP connect answers "is something listening"
 * without caring what the response body is, so this works for any server.
 *
 *   node tools/wait-for-server.mjs http://localhost:8137/ --open
 *   node tools/wait-for-server.mjs http://localhost:8137/ --timeout 30
 *
 * Exit codes: 0 listening, 1 timed out, 2 bad arguments.
 */

import net from 'node:net';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('-'));
const shouldOpen = args.includes('--open');
const timeoutSec = Number(args[args.indexOf('--timeout') + 1]) || 30;

if (!target) {
  console.error('wait-for-server: expected a URL, e.g. http://localhost:8137/');
  process.exit(2);
}

let url;
try {
  url = new URL(target);
} catch {
  console.error(`wait-for-server: "${target}" is not a URL`);
  process.exit(2);
}

const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
const host = url.hostname;

/** One connection attempt. Resolves true if something answered. */
const probe = () => new Promise((resolve) => {
  const socket = net.connect({ host, port });
  const done = (ok) => { socket.destroy(); resolve(ok); };
  socket.setTimeout(1000);
  socket.once('connect', () => done(true));
  socket.once('timeout', () => done(false));
  socket.once('error', () => done(false));
});

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function main() {
  const deadline = Date.now() + timeoutSec * 1000;
  let announced = false;

  while (Date.now() < deadline) {
    if (await probe()) {
      if (shouldOpen) {
        // `start` is a cmd builtin, not an executable, hence the shell. The empty
        // string is the window title: without it cmd treats a quoted URL as the
        // title and opens nothing at all.
        spawn('cmd', ['/c', 'start', '', url.href], { detached: true, stdio: 'ignore' })
          .unref();
        console.log(`wait-for-server: ${url.href} is up — opening your browser`);
      } else {
        console.log(`wait-for-server: ${url.href} is up`);
      }
      return;
    }
    if (!announced) {
      console.log(`wait-for-server: waiting for ${host}:${port} ...`);
      announced = true;
    }
    await sleep(150);
  }

  console.error(
    `wait-for-server: nothing was listening on ${host}:${port} after ${timeoutSec}s.`
  );
  process.exit(1);
}

main();
