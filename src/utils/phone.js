export function digitsOnly(value = "") {
  return value.replace(/\D/g, "");
}

export function formatDZPhone(value = "") {
  const d = digitsOnly(value).slice(0, 10); // 10 أرقام فقط
  const parts = [];
  for (let i = 0; i < d.length; i += 2) parts.push(d.slice(i, i + 2));
  return parts.join("-");
}

export function isValidPhone10(value = "") {
  return digitsOnly(value).length === 10;
}