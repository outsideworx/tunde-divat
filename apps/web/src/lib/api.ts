import type { ProductImageDto } from "@fashion-mvp/shared";

// Same-origin by default. In local network testing, a localhost API URL from
// `.env` must point to the Mac hostname/IP, not the phone's own localhost.
function getApiBase() {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (!configured) return "";
  try {
    const url = new URL(configured);
    const isLocalApi = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isRemoteBrowser = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (isLocalApi && isRemoteBrowser) {
      return "";
    }
    return url.origin;
  } catch {
    return configured;
  }
}

export const API_BASE = getApiBase();

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => ({ error: "" }));
      throw new Error(body.error ?? `A kérés sikertelen (${response.status}).`);
    }
    const text = await response.text().catch(() => "");
    throw new Error(text.trim() || `A kérés sikertelen (${response.status}).`);
  }
  return response.json();
}

export function imageUrl(image?: ProductImageDto) {
  return image ? `${API_BASE}/api/images/${image.id}` : "";
}
