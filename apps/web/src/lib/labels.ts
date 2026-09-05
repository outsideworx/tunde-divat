import type { ReservationStatus } from "@fashion-mvp/shared";

// Hungarian labels for reservation statuses, kept separate from component logic
// so UI copy can change without touching behavior.
export const reservationStatusLabels: Record<ReservationStatus, string> = {
  PROCUREMENT_PENDING: "Beszerzésre vár",
  ACQUIRED: "Beszerezve",
  IN_STOCK_WAITING_PICKUP: "Raktárkészleten, átvételre vár",
  PICKED_UP_PAID: "Átvéve, kifizetve"
};

export const REMEMBER_LOGIN_KEY = "tdo:remember-login";
export const REMEMBERED_USERNAME_KEY = "tdo:remembered-username";

export function favoritesKey(userId: number) {
  return `tdo:favorites:${userId}`;
}
