import { z } from "zod";

export const productStatuses = [
  "DRAFT",
  "PROCESSING",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED"
] as const;

export const generationStatuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
export const imageTypes = ["ORIGINAL", "AI_GENERATED", "FINAL"] as const;
export const userRoles = ["ADMIN", "STAFF"] as const;
export const reservationStatuses = [
  "PROCUREMENT_PENDING",
  "ACQUIRED",
  "IN_STOCK_WAITING_PICKUP",
  "PICKED_UP_PAID"
] as const;

export const allowedSizes = ["XS", "S", "M", "L", "XL", "XXL", "S-M", "M-L", "L-XL"] as const;

export const productPayloadSchema = z.object({
  product_id: z.string().trim().max(80).optional().nullable(),
  product_name: z.string().trim().min(1).max(160).optional().nullable(),
  display_number: z.string().trim().min(1).max(20).regex(/^[\p{L}\p{N}-]+$/u).optional().nullable(),
  price: z.coerce.number().int().positive().max(10_000_000),
  available_sizes: z.array(z.enum(allowedSizes)).min(1).max(12),
  category: z.string().trim().max(80).optional().nullable(),
  color: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  target_group: z.string().trim().max(80).optional().nullable(),
  reservable_until: z.coerce.date().optional().nullable(),
  reservable_duration_hours: z.coerce.number().int().positive().max(24 * 30).optional().nullable()
});

export const pickupOptionPayloadSchema = z.object({
  address: z.string().trim().min(3).max(255),
  start_at: z.coerce.date(),
  end_at: z.coerce.date()
}).refine((payload) => payload.end_at > payload.start_at, {
  message: "Az átvételi idősáv vége legyen később, mint a kezdete.",
  path: ["end_at"]
});

export const reservationPayloadSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  size: z.enum(allowedSizes),
  pickup_id: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number().int().positive().max(20).optional()
});

export const reservationStatusPayloadSchema = z.object({
  status: z.enum(reservationStatuses)
});

export const reservationPickupPayloadSchema = z.object({
  pickup_id: z.coerce.number().int().positive()
});

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(6).max(200)
});

export const registerSchema = loginSchema.extend({
  last_name: z.string().trim().min(1).max(80),
  first_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(40).regex(/^[0-9+\-() /]+$/),
  invite_code: z.string().trim().min(3).max(80),
  privacy_accepted: z.literal(true, {
    errorMap: () => ({ message: "Az adatkezelési tájékoztató elfogadása kötelező." })
  })
});

export const inviteCodePayloadSchema = z.object({
  invite_code: z.string().trim().min(3).max(80)
});

export const adminUserUpdateSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  last_name: z.string().trim().max(80).optional().nullable(),
  first_name: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).regex(/^[0-9+\-() /]*$/).optional().nullable(),
  role: z.enum(userRoles),
  is_active: z.boolean()
});

export type ProductPayload = z.infer<typeof productPayloadSchema>;
export type PickupOptionPayload = z.infer<typeof pickupOptionPayloadSchema>;
export type ReservationPayload = z.infer<typeof reservationPayloadSchema>;
export type ReservationStatusPayload = z.infer<typeof reservationStatusPayloadSchema>;
export type ReservationPickupPayload = z.infer<typeof reservationPickupPayloadSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
export type AdminUserUpdatePayload = z.infer<typeof adminUserUpdateSchema>;
export type ProductStatus = (typeof productStatuses)[number];
export type GenerationStatus = (typeof generationStatuses)[number];
export type ImageType = (typeof imageTypes)[number];
export type UserRole = (typeof userRoles)[number];
export type ReservationStatus = (typeof reservationStatuses)[number];

export function formatHuf(price: number): string {
  return new Intl.NumberFormat("hu-HU", {
    maximumFractionDigits: 0
  }).format(price) + " Ft";
}

export function formatSizes(sizes: string[]): string {
  return sizes.join("; ");
}
