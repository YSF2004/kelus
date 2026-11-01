import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && url.pathname === "/" && !url.search && !url.hash
      && !/(^|\.)supabase\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function publicSupabaseKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(value)) return true;
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    // This is a configuration check, not signature or credential verification.
    return JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "anon";
  } catch {
    return false;
  }
}

function publicEndpoint(value) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function checkProductionConfig(env) {
  const errors = [];
  const warnings = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!url || !httpsOrigin(url)) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must be the HTTPS project origin, not a dashboard or REST URL.");
  }
  if (!key || !publicSupabaseKey(key)) {
    errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable or anon key, never a URL, secret key, or service-role key.");
  }
  for (const name of [
    "NEXT_PUBLIC_WAITLIST_ENDPOINT",
    "NEXT_PUBLIC_QUESTIONS_ENDPOINT",
    "NEXT_PUBLIC_AI_ENDPOINT",
    "NEXT_PUBLIC_MONTHLY_PAYMENT_LINK",
  ]) {
    const value = env[name]?.trim();
    if (value && !publicEndpoint(value)) errors.push(`${name} must be an HTTPS URL or a same-site path.`);
  }
  const measurement = env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (measurement && !/^G-[A-Z0-9]+$/.test(measurement)) {
    errors.push("NEXT_PUBLIC_GA_MEASUREMENT_ID must be a GA4 measurement ID.");
  } else if (!measurement) {
    warnings.push("GA4 is not configured; do not claim that student study events are being measured.");
  }
  return { ok: errors.length === 0, errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkProductionConfig(process.env);
  for (const warning of result.warnings) console.warn(`[production config] ${warning}`);
  for (const error of result.errors) console.error(`[production config] ${error}`);
  if (result.ok) console.log("[production config] Public authentication settings have valid shapes. Live sign-in and sync still require a browser check.");
  process.exitCode = result.ok ? 0 : 1;
}
