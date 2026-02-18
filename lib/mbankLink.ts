const DEFAULT_MBANK_LINK =
  "https://app.mbank.kg/qr/#00020101021132500012c2c.mbank.kg01020210129969900900911202111302115204999953034175405100005910AKTILEK%20K.63046588";

const PHONE_RE = /^996\d{9}$/;

type EmvField = { tag: string; value: string };

export function normalizeMbankNumber(value: string | null | undefined) {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  if (!PHONE_RE.test(digits)) return null;
  return digits;
}

function parseEmvPayload(payload: string): EmvField[] | null {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(payload.trim());
  const fields: EmvField[] = [];
  let cursor = 0;

  while (cursor < bytes.length) {
    if (cursor + 4 > bytes.length) return null;
    const tag = decoder.decode(bytes.slice(cursor, cursor + 2));
    const lenText = decoder.decode(bytes.slice(cursor + 2, cursor + 4));
    if (!/^\d{2}$/.test(lenText)) return null;

    const len = Number(lenText);
    const valueStart = cursor + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > bytes.length) return null;

    fields.push({ tag, value: decoder.decode(bytes.slice(valueStart, valueEnd)) });
    cursor = valueEnd;
  }

  return fields;
}

function serializeEmvPayload(fields: EmvField[]) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  for (const { tag, value } of fields) {
    if (!/^\d{2}$/.test(tag)) return null;
    const valueBytes = encoder.encode(value);
    if (valueBytes.length > 99) return null;

    const head = encoder.encode(`${tag}${String(valueBytes.length).padStart(2, "0")}`);
    chunks.push(head, valueBytes);
    totalLen += head.length + valueBytes.length;
  }

  const merged = new Uint8Array(totalLen);
  let cursor = 0;
  for (const chunk of chunks) {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  }
  return decoder.decode(merged);
}

function crc16ccitt(input: string) {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildMbankPayUrl(params: { totalKgs: number; bankPhone?: string | null; template?: string | null }) {
  const totalKgs = Number(params.totalKgs);
  const amountSom = Number.isFinite(totalKgs) ? Math.max(0, Math.round(totalKgs)) : 0;
  const template = (params.template ?? process.env.NEXT_PUBLIC_MBANK_PAY_URL ?? DEFAULT_MBANK_LINK).trim();
  if (!template) return null;
  if (amountSom <= 0) return template;

  const bankPhone = normalizeMbankNumber(params.bankPhone);

  try {
    const parsedUrl = new URL(template);
    const rawHash = parsedUrl.hash.startsWith("#") ? parsedUrl.hash.slice(1) : parsedUrl.hash;
    if (!rawHash) return template;

    let payload = decodeURIComponent(rawHash).trim();
    if (bankPhone) payload = payload.replace(/996\d{9}/g, bankPhone);

    const fields = parseEmvPayload(payload);
    if (!fields) return template;

    const withoutCrc = fields.filter((field) => field.tag !== "63");
    const amountIndex = withoutCrc.findIndex((field) => field.tag === "54");
    const existingAmountValue = amountIndex >= 0 ? withoutCrc[amountIndex].value : "";

    let amountValue = String(amountSom * 100);
    if (/^\d+$/.test(existingAmountValue)) {
      amountValue = existingAmountValue.length >= 4 ? String(amountSom * 100).padStart(existingAmountValue.length, "0") : String(amountSom);
    } else if (/^\d+\.\d{1,2}$/.test(existingAmountValue)) {
      amountValue = amountSom.toFixed(2);
    }

    if (amountIndex >= 0) {
      withoutCrc[amountIndex] = { ...withoutCrc[amountIndex], value: amountValue };
    } else {
      withoutCrc.push({ tag: "54", value: amountValue });
    }

    const serializedWithoutCrc = serializeEmvPayload(withoutCrc);
    if (!serializedWithoutCrc) return template;

    const payloadWithCrcSeed = `${serializedWithoutCrc}6304`;
    const crc = crc16ccitt(payloadWithCrcSeed);
    parsedUrl.hash = `#${encodeURIComponent(`${payloadWithCrcSeed}${crc}`)}`;
    return parsedUrl.toString();
  } catch {
    return template;
  }
}

