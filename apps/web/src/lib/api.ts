import type { ProductImageDto } from "@fashion-mvp/shared";

// Same-origin by default: in production the API serves the built SPA, so `/api`
// paths resolve against the current origin. For split local dev (Vite on :5173,
// API on :4000) set VITE_API_URL to the API origin.
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? "Request failed");
  }
  return response.json();
}

export function imageUrl(image?: ProductImageDto) {
  return image ? `${API_BASE}/api/images/${image.id}` : "";
}
