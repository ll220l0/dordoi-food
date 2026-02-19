function normalizePhone(phone: string) {
  const hasPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function buildWhatsAppLink(phone: string, text?: string) {
  const normalized = normalizePhone(phone);
  const waPhone = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  const normalizedText = text?.trim() ?? "";
  if (!normalizedText) {
    return `https://wa.me/${waPhone}`;
  }

  const encodedText = encodeURIComponent(normalizedText);
  return `https://wa.me/${waPhone}?text=${encodedText}`;
}
