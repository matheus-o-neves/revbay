// Auth utilities placeholder
export function generateApiKey(): string {
  return `sk_revbay_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}