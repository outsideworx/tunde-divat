import { api, imageUrl } from "./api.js";
import type { Product, ProductImage, ShareVariant } from "../types.js";

export function productDisplayImage(product: Product) {
  return [...product.images].reverse().find((img) => img.imageType === "FINAL")
    ?? product.images.find((img) => img.imageType === "ORIGINAL");
}

export function productOriginalImage(product: Product) {
  return product.images.find((img) => img.imageType === "ORIGINAL");
}

export function productGeneratedImage(product: Product) {
  return [...product.images].reverse().find((img) => img.imageType === "FINAL")
    ?? [...product.images].reverse().find((img) => img.imageType === "AI_GENERATED");
}

export function imageExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export function shareFilename(product: Product, variant: ShareVariant, contentType: string) {
  const suffix = variant === "raw" ? "_nyers" : "";
  return `termek_${product.displayNumber}${suffix}.${imageExtension(contentType)}`;
}

export async function imageFileForShare(product: Product, image: ProductImage, variant: ShareVariant) {
  const response = await fetch(imageUrl(image), { credentials: "include" });
  if (!response.ok) throw new Error("A kép letöltése sikertelen.");
  const blob = await response.blob();
  const type = blob.type || response.headers.get("Content-Type") || "image/jpeg";
  return new File([blob], shareFilename(product, variant, type), { type });
}

export async function downloadProductImage(product: Product, image: ProductImage, variant: ShareVariant = "generated") {
  const response = await fetch(imageUrl(image), { credentials: "include" });
  if (!response.ok) throw new Error("A kép letöltése sikertelen.");
  const blob = await response.blob();
  const type = blob.type || response.headers.get("Content-Type") || "image/jpeg";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = shareFilename(product, variant, type);
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function deleteProduct(product: Product) {
  const confirmed = window.confirm(`Biztosan a törölt tételek közé helyezed ezt a terméket? #${product.displayNumber} (${product.productId})`);
  if (!confirmed) return false;
  await api(`/api/products/${product.id}`, { method: "DELETE" });
  return true;
}
