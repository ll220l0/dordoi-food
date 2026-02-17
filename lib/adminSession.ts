const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const ADMIN_SESSION_COOKIE = "dordoi_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type AdminSessionPayload = {
  u: string;
  exp: number;
};

type AdminCredentials = {
  user: string;
  pass: string;
  secret: string;
};

function getAdminCredentials(): AdminCredentials | null {
  const user = process.env.ADMIN_USER?.trim() ?? "";
  const pass = process.env.ADMIN_PASS?.trim() ?? "";
  if (!user || !pass) return null;

  const secret = (process.env.ADMIN_SESSION_SECRET?.trim() || `${user}:${pass}:session`).slice(0, 512);
  return { user, pass, secret };
}

function toBase64Url(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;

    const n = (a << 16) | (b << 8) | c;

    out += alphabet[(n >> 18) & 63]!;
    out += alphabet[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += alphabet[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) out += alphabet[n & 63]!;
  }

  return out;
}

function fromBase64Url(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const table = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i += 1) table.set(alphabet[i]!, i);

  if (!input) return new Uint8Array(0);
  if (input.length % 4 === 1) return null;

  const bytes: number[] = [];
  let i = 0;
  while (i < input.length) {
    const c0 = table.get(input[i] ?? "");
    const c1 = table.get(input[i + 1] ?? "");
    if (c0 == null || c1 == null) return null;

    const c2Char = input[i + 2] ?? "";
    const c3Char = input[i + 3] ?? "";
    const c2 = c2Char ? table.get(c2Char) : undefined;
    const c3 = c3Char ? table.get(c3Char) : undefined;

    if (c2Char && c2 == null) return null;
    if (c3Char && c3 == null) return null;

    const n = (c0 << 18) | (c1 << 12) | ((c2 ?? 0) << 6) | (c3 ?? 0);
    bytes.push((n >> 16) & 255);
    if (c2Char) bytes.push((n >> 8) & 255);
    if (c3Char) bytes.push(n & 255);

    i += 4;
  }

  return new Uint8Array(bytes);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function hasAdminCredentials() {
  return Boolean(getAdminCredentials());
}

export function validateAdminPassword(inputUser: string, inputPass: string) {
  const creds = getAdminCredentials();
  if (!creds) return false;
  return timingSafeEqual(inputUser, creds.user) && timingSafeEqual(inputPass, creds.pass);
}

export async function createAdminSessionToken() {
  const creds = getAdminCredentials();
  if (!creds) return null;

  const payload: AdminSessionPayload = {
    u: creds.user,
    exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000
  };
  const payloadEncoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await signValue(payloadEncoded, creds.secret);
  return `${payloadEncoded}.${sig}`;
}

export async function verifyAdminSessionToken(token: string) {
  const creds = getAdminCredentials();
  if (!creds) return false;

  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return false;

  const expectedSig = await signValue(payloadEncoded, creds.secret);
  if (!timingSafeEqual(signature, expectedSig)) return false;

  const decoded = fromBase64Url(payloadEncoded);
  if (!decoded) return false;

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(decoder.decode(decoded)) as AdminSessionPayload;
  } catch {
    return false;
  }

  if (!payload?.u || typeof payload.exp !== "number") return false;
  if (payload.u !== creds.user) return false;
  if (Date.now() >= payload.exp) return false;

  return true;
}
