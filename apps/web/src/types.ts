// Entity/response shapes come from the shared package (single source of truth).
// Aliased to the short names the UI uses.
export type {
  PickupOptionDto as PickupOption,
  ProductDto as Product,
  ProductImageDto as ProductImage,
  RegisteredUserDto as RegisteredUser,
  ReservationDto as Reservation,
  UserDto as User
} from "@fashion-mvp/shared";

// UI-only unions (not part of the API contract).
export type Step = "photo" | "data" | "saved";
export type View = "dashboard" | "storefront" | "new" | "ai" | "share" | "current" | "orders" | "pickup" | "deleted";
export type AdminView = View | "users";
export type AuthMode = "login" | "register";
export type StoreView = "catalog" | "reservations" | "favorites";
export type ShareVariant = "raw" | "generated";
export type ModelGender = "female" | "male";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
