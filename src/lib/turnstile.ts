export function turnstileConfiguration() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  const hostname = process.env.TURNSTILE_EXPECTED_HOSTNAME ?? "";
  return {
    siteKey,
    secret,
    hostname,
    enabled: Boolean(siteKey || secret || hostname),
    ready: Boolean(siteKey && secret && hostname),
  };
}
export async function verifyTurnstile(token: unknown) {
  const config = turnstileConfiguration();
  if (!config.enabled) return true;
  if (
    !config.ready ||
    typeof token !== "string" ||
    !token ||
    token.length > 2048
  )
    return false;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: config.secret, response: token }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return Boolean(
      result &&
      typeof result === "object" &&
      "success" in result &&
      result.success === true &&
      "action" in result &&
      result.action === "login" &&
      "hostname" in result &&
      result.hostname === config.hostname,
    );
  } catch {
    return false;
  }
}
