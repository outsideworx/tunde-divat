import type { ProductPayload } from "@fashion-mvp/shared";

// A public display number is any positive integer string; "0" and non-numeric
// values are treated as "not yet assigned".
const PUBLIC_DISPLAY_NUMBER_PATTERN = /^[1-9][0-9]*$/;

export function isPublicDisplayNumber(displayNumber: string): boolean {
  return PUBLIC_DISPLAY_NUMBER_PATTERN.test(displayNumber);
}

// Fields whose change should trigger a FINAL-overlay rebuild, because the
// overlay renders the display number, price, and sizes onto the image.
export function shouldRegenerateOverlay(payload: Partial<ProductPayload>): boolean {
  return (
    payload.display_number !== undefined ||
    payload.price !== undefined ||
    payload.available_sizes !== undefined
  );
}

type CategorySource = Pick<
  ProductPayload,
  "product_id" | "product_name" | "description" | "brand" | "color"
>;

export function inferCategory(source: Partial<CategorySource>): string {
  const text = [source.product_id, source.product_name, source.description, source.brand, source.color]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/(cipő|cipo|shoe|csizma|szandál|szandal|sneaker)/i.test(text)) return "Cipő";
  if (/(nadrág|nadrag|farmer|jeans|leggings|szoknya)/i.test(text)) return "Alsó";
  if (/(kabát|kabat|dzseki|blézer|blezer|mellény|melleny)/i.test(text)) return "Kabát";
  if (/(ruha|dress|overál|overal)/i.test(text)) return "Ruha";
  if (/(felső|felso|póló|polo|blúz|bluz|pulóver|pulover|top|ing)/i.test(text)) return "Felső";
  if (/(táska|taska|öv|ov|sál|sal|sapka|kiegészítő|kiegeszito)/i.test(text)) return "Kiegészítő";
  return "Ruházat";
}
