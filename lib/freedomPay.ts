import crypto from "crypto";

const DEFAULT_API_BASE = "https://api.freedompay.kz";
type RawParams = Record<string, string | number | boolean | null | undefined>;

function toStringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

export function buildFreedomPayConfig() {
  const merchantId = process.env.FREEDOMPAY_MERCHANT_ID?.trim() ?? "";
  const secretKey = process.env.FREEDOMPAY_SECRET_KEY?.trim() ?? "";
  const apiBase = (process.env.FREEDOMPAY_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  const currencyRaw = process.env.FREEDOMPAY_CURRENCY?.trim() ?? "";
  const currency = currencyRaw ? currencyRaw.toUpperCase() : "";
  const testMode = (process.env.FREEDOMPAY_TEST_MODE?.trim() ?? "") === "1";

  return {
    enabled: Boolean(merchantId && secretKey),
    merchantId,
    secretKey,
    apiBase,
    currency,
    testMode
  };
}

function flattenParams(params: RawParams) {
  return Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = toStringValue(value);
    return acc;
  }, {});
}

export function signFreedomPayParams(scriptName: string, params: RawParams, secretKey: string) {
  const flat = flattenParams(params);
  const keys = Object.keys(flat)
    .filter((key) => key !== "pg_sig")
    .sort((a, b) => a.localeCompare(b));

  const signatureParts = [scriptName, ...keys.map((key) => flat[key]), secretKey];
  return crypto.createHash("md5").update(signatureParts.join(";")).digest("hex");
}

export function verifyFreedomPaySignature(scriptName: string, params: RawParams, secretKey: string) {
  const provided = toStringValue(params.pg_sig).trim().toLowerCase();
  if (!provided) return false;

  const expected = signFreedomPayParams(scriptName, params, secretKey).toLowerCase();
  return provided === expected;
}

export function makeFreedomPaySalt() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

export function scriptNameFromPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  const part = normalized.split("/").pop() || "result";
  return part || "result";
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function parseFreedomPayPayload(raw: string, contentType?: string | null) {
  const payload: Record<string, string> = {};
  const ct = (contentType || "").toLowerCase();

  if (ct.includes("application/json")) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) payload[key] = toStringValue(value);
    return payload;
  }

  if (ct.includes("x-www-form-urlencoded") || (/^[^<>{}\n]+=[^\n]+/.test(raw) && raw.includes("&"))) {
    const params = new URLSearchParams(raw);
    for (const [key, value] of params.entries()) payload[key] = value;
    return payload;
  }

  const xmlTagRegex = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = xmlTagRegex.exec(raw)) !== null) {
    const [, key, value] = match;
    if (!key || key === "response") continue;
    payload[key] = decodeXmlEntities(value.trim());
  }

  return payload;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildFreedomPayResultXml(params: RawParams) {
  const flat = flattenParams(params);
  const body = Object.entries(flat)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><response>${body}</response>`;
}

export function formatFreedomPayAmount(totalKgs: number) {
  return `${Math.max(0, Math.round(totalKgs))}.00`;
}

export function resolvePublicOrigin(req: Request) {
  const fromEnv = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
}
