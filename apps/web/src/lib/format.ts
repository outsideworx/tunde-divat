import { formatHuf } from "@fashion-mvp/shared";
import type { PickupOption, Product } from "../types.js";

export function formatDateTime(value?: string | null) {
  if (!value) return "Nincs megadva";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "Nincs megadva";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function formatReservationDeadline(value?: string | null) {
  return value ? formatDateTime(value) : "Lejárat nélkül";
}

export function formatPickupRange(pickup?: PickupOption) {
  if (!pickup) return "Nincs megadva";
  const start = new Date(pickup.startAt);
  const end = new Date(pickup.endAt);
  const startIsDefault = start.getHours() === 9 && start.getMinutes() === 0;
  const endIsDefault = end.getHours() === 17 && end.getMinutes() === 0;
  if (startIsDefault && endIsDefault) {
    return `${formatDateOnly(pickup.startAt)} 9:00-17:00`;
  }
  return `${formatDateTime(pickup.startAt)} - ${formatDateTime(pickup.endAt)}`;
}

export function productTitle(product: Product) {
  const name = product.productName || product.category || product.description?.split(/[.\n]/)[0].trim().slice(0, 48) || "Termék";
  return `#${product.displayNumber} ${name}`;
}

export function localDateAt(date: string, hour: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

export function formatRemaining(value?: string | null) {
  if (!value) return "Szabadon foglalható";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Lejárt";
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} nap ${hours % 24} óra`;
  }
  return `${hours} óra ${String(minutes).padStart(2, "0")} perc`;
}

export function isDeadlineUrgent(value?: string | null) {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff > 0 && diff <= 4 * 60 * 60 * 1000;
}

export function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function productShareText(product: Product) {
  return `${productTitle(product)} - ${formatHuf(product.price)}\nMéretek: ${product.sizes.map((s) => s.size).join("; ")}${product.description ? `\n${product.description}` : ""}`;
}
