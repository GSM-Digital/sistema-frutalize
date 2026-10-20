import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstile } from "../src/lib/turnstile";
test("Turnstile verifies on the server and fails closed for invalid configuration or responses", async (t) => {
  const original = {
    site: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    secret: process.env.TURNSTILE_SECRET_KEY,
    host: process.env.TURNSTILE_EXPECTED_HOSTNAME,
    required: process.env.TURNSTILE_REQUIRED,
    nodeEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.VERCEL_ENV,
  };
  t.after(() => {
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: original.site,
      TURNSTILE_SECRET_KEY: original.secret,
      TURNSTILE_EXPECTED_HOSTNAME: original.host,
      TURNSTILE_REQUIRED: original.required,
      NODE_ENV: original.nodeEnvironment,
      VERCEL_ENV: original.vercelEnvironment,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    t.mock.restoreAll();
  });
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_EXPECTED_HOSTNAME;
  delete process.env.TURNSTILE_REQUIRED;
  delete process.env.VERCEL_ENV;
  Reflect.set(process.env, "NODE_ENV", "development");
  assert.equal(await verifyTurnstile(null), true);
  Reflect.set(process.env, "NODE_ENV", "production");
  assert.equal(await verifyTurnstile(null), false);
  Reflect.set(process.env, "NODE_ENV", "development");
  process.env.TURNSTILE_REQUIRED = "true";
  assert.equal(await verifyTurnstile(null), false);
  delete process.env.TURNSTILE_REQUIRED;
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "public-test";
  assert.equal(await verifyTurnstile("test-token"), false);
  process.env.TURNSTILE_SECRET_KEY = "secret-test";
  process.env.TURNSTILE_EXPECTED_HOSTNAME = "sistema.frutalize.com.br";
  assert.equal(await verifyTurnstile(""), false);
  assert.equal(await verifyTurnstile("a".repeat(2049)), false);
  let answer = {
    success: true,
    action: "login",
    hostname: "sistema.frutalize.com.br",
  };
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) => {
      assert.equal(JSON.parse(String(options?.body)).secret, "secret-test");
      return Response.json(answer);
    },
  );
  assert.equal(await verifyTurnstile("test-token"), true);
  answer = { ...answer, hostname: "evil.example" };
  assert.equal(await verifyTurnstile("test-token"), false);
  answer = {
    ...answer,
    hostname: "sistema.frutalize.com.br",
    action: "another-action",
  };
  assert.equal(await verifyTurnstile("test-token"), false);
  answer = { ...answer, action: "login", success: false };
  assert.equal(await verifyTurnstile("test-token"), false);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network unavailable");
  });
  assert.equal(await verifyTurnstile("test-token"), false);
});
