// Protocol-only smoke checks. No browser or visual automation is used.
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3026";
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(`${base}/login`, {
      redirect: "manual",
      signal: AbortSignal.timeout(1000),
    });
    if (response.status === 200) {
      ready = true;
      break;
    }
  } catch {}
  await setTimeout(500);
}
assert.ok(ready, "The application did not become ready");
for (const path of [
  "/",
  "/dashboard",
  "/dashboard/lotes",
  "/dashboard/historico",
  "/dashboard/recebimentos/novo",
]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.ok(
    [303, 307, 308].includes(response.status),
    `${path} must redirect before streaming`,
  );
  assert.ok(
    response.headers.get("location")?.includes("/login"),
    `${path} must require login`,
  );
  console.log(`PASS ${path}: requires login (${response.status})`);
}
const login = await fetch(`${base}/login`);
assert.equal(login.status, 200);
const html = await login.text();
assert.ok(html.includes("Bem-vindo de volta"));
assert.ok(html.includes('name="email"') && html.includes('name="password"'));
console.log("PASS /login: login form rendered");
const health = await fetch(`${base}/api/health`);
assert.ok([200, 503].includes(health.status));
assert.equal((await health.json()).app, "ok");
console.log(`PASS /api/health: application responds (${health.status})`);
assert.equal((await fetch(`${base}/favicon.ico`)).status, 200);
console.log("PASS /favicon.ico: public asset available");
