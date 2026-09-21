import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Ban, Camera, ChevronLeft, ChevronRight, Download, Eye, FolderCheck, Heart, KeyRound, LogOut, Menu, PanelLeftClose, Plus, RefreshCcw, Search, Share2, ShoppingBag, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { allowedSizes, formatHuf, type ReservationStatus } from "@fashion-mvp/shared";
import "./styles.css";
import { useEffect, useMemo, useRef, useState } from "react";

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

const API = getApiBase();

type ImageViewType = "FRONT" | "BACK" | "DETAIL" | "AUTO" | "OTHER";
type ProductImage = { id: number; imageType: "ORIGINAL" | "AI_GENERATED" | "FINAL"; width?: number; height?: number; sortOrder?: number; sourceImageId?: number | null; isHidden?: boolean; viewType?: ImageViewType };
type Product = {
  id: number;
  productId: string;
  productName?: string | null;
  displayNumber: string;
  price: number;
  status: string;
  category?: string;
  color?: string;
  brand?: string;
  description?: string;
  reservableUntil?: string | null;
  reservableDurationHours?: number | null;
  displayImageId?: number | null;
  sizes: { color?: string | null; size: string; quantity?: number | null }[];
  images: ProductImage[];
  createdAt: string;
};
type PickupOption = { id: number; address: string; startAt: string; endAt: string; isActive: boolean };
type Reservation = {
  id: number;
  productFk: number;
  userId: number;
  pickupFk?: number | null;
  color?: string | null;
  size: string;
  quantity: number;
  status: ReservationStatus;
  canCancel: boolean;
  reservedAt: string;
  cancelledAt?: string | null;
  product: Product;
  pickup?: PickupOption | null;
  user?: { id: number; username: string; email?: string | null };
};

type User = { id: number; username: string; email?: string | null; role: string };
type RegisteredUser = User & { lastName?: string | null; firstName?: string | null; phone?: string | null; isActive: boolean; privacyAcceptedAt?: string | null; createdAt: string };
type RegisteredUserForm = {
  username: string;
  last_name: string;
  first_name: string;
  phone: string;
  email: string;
  role: "ADMIN" | "STAFF";
  is_active: boolean;
};
type Step = "photo" | "data" | "saved";
type View = "dashboard" | "storefront" | "quick" | "new" | "ai" | "share" | "current" | "orders" | "pickup" | "deleted";
type AdminView = View | "users";
type AuthMode = "login" | "register";
type StoreView = "catalog" | "reservations" | "favorites";
type ShareVariant = "raw" | "generated" | "multi";
type ModelGender = "female" | "male";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const REMEMBER_LOGIN_KEY = "tdo:remember-login";
const REMEMBERED_USERNAME_KEY = "tdo:remembered-username";
const PURCHASED_PROCUREMENT_ITEMS_KEY = "tdo:purchased-procurement-items";
const activeAiBatch = { running: false, stopRequested: false, controller: null as AbortController | null };
const imageViewOptions: { value: ImageViewType; label: string; hint?: string }[] = [
  { value: "FRONT", label: "Elölnézet" },
  { value: "BACK", label: "Hátulnézet" },
  { value: "DETAIL", label: "Részlet" },
  { value: "AUTO", label: "Automatikus felismerés" },
  { value: "OTHER", label: "Egyéb - nem AI-generálható", hint: "Például színminta vagy címke." }
];

const reservationStatusLabels: Record<ReservationStatus, string> = {
  PROCUREMENT_PENDING: "Beszerzésre vár",
  ACQUIRED: "Beszerezve",
  IN_STOCK_WAITING_PICKUP: "Raktárkészleten, átvételre vár",
  PICKED_UP_PAID: "Átvéve, kifizetve"
};
const procurementStatuses: ReservationStatus[] = ["PROCUREMENT_PENDING", "ACQUIRED", "IN_STOCK_WAITING_PICKUP"];
const customerFulfillmentStatuses: ReservationStatus[] = ["IN_STOCK_WAITING_PICKUP", "PICKED_UP_PAID"];
const customerFulfillmentStatusLabels: Record<ReservationStatus, string> = {
  ...reservationStatusLabels,
  IN_STOCK_WAITING_PICKUP: "Átvételre vár",
  PICKED_UP_PAID: "Átvette, kifizette"
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
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

function imageUrl(image?: ProductImage) {
  return image ? `${API}/api/images/${image.id}` : "";
}

function imageViewLabel(viewType?: ImageViewType) {
  return imageViewOptions.find((option) => option.value === (viewType ?? "AUTO"))?.label ?? "Automatikus felismerés";
}

function productDisplayImage(product: Product) {
  const visible = visibleProductShareImages(product);
  return visible.find((img) => img.id === product.displayImageId) ?? visible[0];
}

function productOriginalImage(product: Product) {
  return product.images.find((img) => img.imageType === "ORIGINAL");
}

function productOriginalImages(product: Product) {
  return product.images.filter((img) => img.imageType === "ORIGINAL");
}

function visibleProductOriginalImages(product: Product) {
  return productOriginalImages(product).filter((image) => !image.isHidden);
}

function productShareImages(product: Product) {
  const finals = product.images.filter((image) => image.imageType === "FINAL");
  const latestFinalBySource = new Map<string, ProductImage>();
  for (const image of finals) {
    const key = image.sourceImageId == null ? "legacy" : String(image.sourceImageId);
    const current = latestFinalBySource.get(key);
    if (!current || image.id > current.id) latestFinalBySource.set(key, image);
  }
  const finalIds = new Set([...latestFinalBySource.values()].map((image) => image.id));
  const finalSourceIds = new Set([...latestFinalBySource.values()].map((image) => image.sourceImageId).filter((id): id is number => id != null));
  return product.images.filter((image) => {
    if (image.imageType === "ORIGINAL") return true;
    if (image.imageType === "FINAL") return finalIds.has(image.id);
    if (image.imageType !== "AI_GENERATED") return false;
    return image.sourceImageId == null ? finalIds.size === 0 : !finalSourceIds.has(image.sourceImageId);
  });
}

function visibleProductShareImages(product: Product) {
  return productShareImages(product).filter((image) => !image.isHidden);
}

function productGeneratedImage(product: Product) {
  return [...product.images].reverse().find((img) => img.imageType === "FINAL") ??
    [...product.images].reverse().find((img) => img.imageType === "AI_GENERATED");
}

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

function shareFilename(product: Product, variant: ShareVariant, contentType: string) {
  const suffix = variant === "raw" ? "_nyers" : "";
  return `termek_${product.displayNumber}${suffix}.${imageExtension(contentType)}`;
}

async function imageFileForShare(product: Product, image: ProductImage, variant: ShareVariant) {
  const response = await fetch(imageUrl(image), { credentials: "include" });
  if (!response.ok) throw new Error("A kép letöltése sikertelen.");
  const blob = await response.blob();
  const type = blob.type || response.headers.get("Content-Type") || "image/jpeg";
  return new File([blob], shareFilename(product, variant, type), { type });
}

async function downloadProductImage(product: Product, image: ProductImage, variant: ShareVariant = "generated") {
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

function productShareText(product: Product) {
  return `${productTitle(product)} - ${formatHuf(product.price)}\nMéretek: ${formatProductSizes(product)}${product.description ? `\n${product.description}` : ""}`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replaceAll('"', '""');
  return `"${normalized}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  downloadFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Nincs megadva";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateOnly(value?: string | null) {
  if (!value) return "Nincs megadva";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function formatPickupDay(value?: string | null) {
  if (!value) return "Később egyeztetendő";
  return new Intl.DateTimeFormat("hu-HU", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function pickupDayKey(value?: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatReservationDeadline(value?: string | null) {
  return value ? formatDateTime(value) : "Határidő nélkül foglalható";
}

function formatPickupRange(pickup?: PickupOption) {
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

function pickupAddress(pickup?: PickupOption | null) {
  return pickup?.address ?? "Később egyeztetendő";
}

function pickupRangeText(pickup?: PickupOption | null) {
  return pickup ? formatPickupRange(pickup) : "Később egyeztetendő";
}

function groupDayLabel(day: string, value?: string | null) {
  return day === "unknown" ? "Később egyeztetendő" : formatPickupDay(value);
}

function productTitle(product: Product) {
  const name = product.productName || product.category || product.description?.split(/[.\n]/)[0].trim().slice(0, 48) || "Termék";
  return `#${product.displayNumber} ${name}`;
}

function productNumberPair(product: Product) {
  return `${product.productId} / #${product.displayNumber}`;
}

function customerProductTitle(product: Product) {
  return product.productName || product.category || product.description?.split(/[.\n]/)[0].trim().slice(0, 48) || "Termék";
}

function productColors(product: Product) {
  return [...new Set(product.sizes.map((size) => size.color?.trim()).filter((color): color is string => Boolean(color)))];
}

function sortedProductSizes(product: Product, color?: string | null) {
  return product.sizes
    .filter((size) => color === undefined || (size.color ?? null) === color)
    .sort((a, b) => allowedSizes.indexOf(a.size as (typeof allowedSizes)[number]) - allowedSizes.indexOf(b.size as (typeof allowedSizes)[number]));
}

function formatProductSizes(product: Product, includeQuantity = false) {
  const colors = productColors(product);
  const formatSize = (item: Product["sizes"][number]) => `${item.size}${includeQuantity && item.quantity != null ? ` (${item.quantity} db)` : ""}`;
  if (!colors.length) return sortedProductSizes(product).map(formatSize).join("; ");
  return colors.map((color) => `${color}: ${sortedProductSizes(product, color).map(formatSize).join(", ")}`).join("; ");
}

function ProductSizeList({ product }: { product: Product }) {
  const colors = productColors(product);
  if (!colors.length) {
    return <span className="product-size-lines"><span>{sortedProductSizes(product).map((size) => size.size).join(", ")}</span></span>;
  }
  return (
    <span className="product-size-lines">
      {colors.map((color) => <span key={color}><b>{color}:</b> {sortedProductSizes(product, color).map((size) => size.size).join(", ")}</span>)}
    </span>
  );
}

function productIdFromPath() {
  const match = window.location.pathname.match(/^\/product\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function localDateAt(date: string, hour: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

function formatRemaining(value?: string | null) {
  if (!value) return "Határidő nélkül foglalható";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Lejárt";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (totalSeconds < 3_600) return `${pad(minutes)}:${pad(seconds)}`;
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatCancelRemaining(reservation: Reservation) {
  if (!reservation.canCancel) return "Nem lemondható";
  const diff = new Date(reservation.reservedAt).getTime() + 10 * 60 * 1000 - Date.now();
  if (diff <= 0) return "Lejárt";
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function canCancelReservation(reservation: Reservation) {
  return reservation.canCancel && new Date(reservation.reservedAt).getTime() + 10 * 60 * 1000 >= Date.now();
}

function isDeadlineUrgent(value?: string | null) {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff <= 2 * 60 * 60 * 1000;
}

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function deleteProduct(product: Product) {
  const confirmed = window.confirm(`Biztosan a törölt tételek közé helyezed ezt a terméket? #${product.displayNumber} (${product.productId})`);
  if (!confirmed) return false;
  await api(`/api/products/${product.id}`, { method: "DELETE" });
  return true;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (window.location.pathname === "/adatkezelesi-tajekoztato") return <PrivacyNotice />;
  if (loading) return <div className="boot">Betöltés...</div>;
  if (!user) return <Login onLogin={setUser} />;
  if (user.role !== "ADMIN") return <CustomerStorefront user={user} onLogout={() => setUser(null)} />;
  return <Shell user={user} onLogout={() => setUser(null)} />;
}

function PrivacyNotice() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <img className="legal-logo" src="/assets/tunde-divat-online-logo.jpeg" alt="Tünde Divat Online" />
        <p className="eyebrow">Adatkezelési tájékoztató</p>
        <h1>Tünde Divat Online</h1>
        <p>
          A Tünde Divat Online foglalási felület használata során személyes adatokat kezelünk azért,
          hogy a regisztráció, a termékfoglalás és az átvételi egyeztetés működni tudjon.
        </p>
        <h2>Adatkezelő</h2>
        <p>
          Tünde Divat Online<br />
          Weboldal: www.tundedivat.com<br />
          E-mail: rozalia.boa@gmail.com<br />
          Telefonszám: +36 30 56 56 576
        </p>
        <h2>Kezelt adatok</h2>
        <p>
          Regisztrációkor a felhasználónevet, vezetéknevet, keresztnevet, telefonszámot, jelszót
          technikailag védett formában, meghívókódot és az adatkezelési tájékoztató elfogadásának
          időpontját kezeljük. Foglaláskor a termék, méret, darabszám, ár, foglalási időpont és
          átvételi adatok kerülnek rögzítésre.
        </p>
        <h2>Az adatkezelés célja és jogalapja</h2>
        <p>
          Az adatkezelés célja a felhasználói fiók kezelése, a foglalások nyilvántartása, az átvétel
          megszervezése és a kapcsolattartás. A regisztráció és a foglalási rendszer használata a
          felhasználó hozzájárulásán, illetve a foglalás teljesítéséhez szükséges adatkezelésen alapul.
        </p>
        <h2>Adatmegőrzés és hozzáférés</h2>
        <p>
          Az adatokat addig kezeljük, amíg a fiók aktív, illetve amíg a foglalások teljesítéséhez,
          nyilvántartásához vagy egyeztetéséhez szükséges. Az adatokhoz csak az arra jogosult
          adminisztrátorok férhetnek hozzá.
        </p>
        <h2>Felhasználói jogok</h2>
        <p>
          A felhasználó kérhet tájékoztatást az adatkezelésről, kérheti adatai helyesbítését,
          törlését, kezelésének korlátozását, valamint tiltakozhat az adatkezelés ellen. Panasz esetén
          a Nemzeti Adatvédelmi és Információszabadság Hatósághoz lehet fordulni.
        </p>
        <a className="secondary legal-back" href="/">Vissza a bejelentkezéshez</a>
      </article>
    </main>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [rememberLogin, setRememberLogin] = useState(() => window.localStorage.getItem(REMEMBER_LOGIN_KEY) === "true");
  const [username, setUsername] = useState(() => window.localStorage.getItem(REMEMBER_LOGIN_KEY) === "true" ? window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? "" : "");
  const [password, setPassword] = useState("");
  const [registerForm, setRegisterForm] = useState({
    username: "",
    last_name: "",
    first_name: "",
    phone: "",
    password: "",
    invite_code: "",
    privacy_accepted: false
  });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (authMode === "login") {
      if (!username.trim()) return setError("Add meg a felhasználónevet.");
      if (!password) return setError("Add meg a jelszót.");
    } else {
      if (!registerForm.username.trim()) return setError("Add meg a felhasználónevet.");
      if (!registerForm.last_name.trim()) return setError("Add meg a vezetéknevet.");
      if (!registerForm.first_name.trim()) return setError("Add meg a keresztnevet.");
      if (!registerForm.phone.trim()) return setError("Add meg a telefonszámot.");
      if (!registerForm.password) return setError("Add meg a jelszót.");
      if (!registerForm.invite_code.trim()) return setError("Add meg a meghívókódot.");
      if (!registerForm.privacy_accepted) return setError("Az adatkezelési tájékoztató elfogadása kötelező.");
    }
    try {
      const res = await api<{ user: User }>(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify(authMode === "login" ? { username, password } : registerForm)
      });
      if (authMode === "login") {
        if (rememberLogin) {
          window.localStorage.setItem(REMEMBER_LOGIN_KEY, "true");
          window.localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
        } else {
          window.localStorage.removeItem(REMEMBER_LOGIN_KEY);
          window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
        }
      }
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sikertelen művelet");
    }
  }

  function setRegister<K extends keyof typeof registerForm>(key: K, value: (typeof registerForm)[K]) {
    setRegisterForm((current) => ({ ...current, [key]: value }));
  }

  function updateRememberLogin(checked: boolean) {
    setRememberLogin(checked);
    if (!checked) {
      window.localStorage.removeItem(REMEMBER_LOGIN_KEY);
      window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  }

  return (
    <main className="auth-shell">
      <span className="build-version">ver.: 1.03</span>
      <section className="brand-panel">
        <span className="sr-only">Tünde Divat Online</span>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit} autoComplete={rememberLogin ? "on" : "off"}>
          <div className="auth-tabs">
            <button className={`tab-button ${authMode === "login" ? "active" : ""}`} type="button" onClick={() => setAuthMode("login")}>Bejelentkezés</button>
            <button className={`tab-button ${authMode === "register" ? "active" : ""}`} type="button" onClick={() => setAuthMode("register")}>Regisztráció</button>
          </div>
          <h1>Tünde Divat Online</h1>
          {authMode === "login" ? (
            <>
              <label>
                Felhasználónév
                <input
                  value={username}
                  name={rememberLogin ? "username" : "tdo-login-user"}
                  onChange={(e) => setUsername(e.target.value)}
                  type="text"
                  autoComplete={rememberLogin ? "username" : "off"}
                />
              </label>
              <label>
                Jelszó
                <input
                  value={password}
                  name={rememberLogin ? "password" : "tdo-login-pass"}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={rememberLogin ? "current-password" : "new-password"}
                />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={rememberLogin} onChange={(event) => updateRememberLogin(event.target.checked)} />
                <span>Emlékezzen rám</span>
              </label>
            </>
          ) : (
            <>
              <label>Felhasználónév<input value={registerForm.username} onChange={(e) => setRegister("username", e.target.value)} type="text" autoComplete="username" /></label>
              <label>Vezetéknév<input value={registerForm.last_name} onChange={(e) => setRegister("last_name", e.target.value)} type="text" autoComplete="family-name" /></label>
              <label>Keresztnév<input value={registerForm.first_name} onChange={(e) => setRegister("first_name", e.target.value)} type="text" autoComplete="given-name" /></label>
              <label>Telefonszám<input value={registerForm.phone} onChange={(e) => setRegister("phone", e.target.value)} type="tel" autoComplete="tel" /></label>
              <label>Jelszó<input value={registerForm.password} onChange={(e) => setRegister("password", e.target.value)} type="password" autoComplete="new-password" /></label>
              <label>Meghívókód<input value={registerForm.invite_code} onChange={(e) => setRegister("invite_code", e.target.value)} type="text" /></label>
              <label className="check-row privacy-consent">
                <input
                  checked={registerForm.privacy_accepted}
                  onChange={(e) => setRegister("privacy_accepted", e.target.checked)}
                  type="checkbox"
                />
                <span>
                  Elolvastam és elfogadom az <a href="/adatkezelesi-tajekoztato" target="_blank" rel="noreferrer">adatkezelési tájékoztatót</a>.
                </span>
              </label>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary tdo-primary" type="submit">{authMode === "login" ? "Bejelentkezés" : "Regisztráció"}</button>
        </form>
      </section>
    </main>
  );
}

function CustomerStorefront({ user, onLogout, onBackToAdmin }: { user: User; onLogout: () => void; onBackToAdmin?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pickups, setPickups] = useState<PickupOption[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [storeView, setStoreView] = useState<StoreView>("catalog");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [detailProductId, setDetailProductId] = useState<number | null>(() => productIdFromPath());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  async function loadStoreData() {
    const [productRes, pickupRes, reservationRes] = await Promise.all([
      api<{ products: Product[] }>("/api/products"),
      api<{ options: PickupOption[] }>("/api/pickups"),
      api<{ reservations: Reservation[] }>("/api/reservations/my")
    ]);
    setProducts(productRes.products);
    setPickups(pickupRes.options);
    setReservations(reservationRes.reservations);
  }

  useEffect(() => {
    loadStoreData().catch((err) => setError(err instanceof Error ? err.message : "A kínálat betöltése sikertelen"));
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(`tdo:favorites:${user.id}`);
    setFavoriteIds(raw ? JSON.parse(raw) as number[] : []);
  }, [user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onPopState = () => setDetailProductId(productIdFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    onLogout();
  }

  const offerProducts = products.filter((product) => product.status === "APPROVED" && productDisplayImage(product));
  const categories = Array.from(new Set(offerProducts.map((product) => product.category).filter(Boolean) as string[]));
  const visible = offerProducts.filter((product) => {
    const haystack = [product.productName, product.category, product.description, product.sizes.map((s) => s.size).join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!category || product.category === category);
  });
  const favoriteProducts = offerProducts.filter((product) => favoriteIds.includes(product.id));
  const reservationTotals = reservations.reduce((totals, reservation) => {
    totals.count += reservation.quantity;
    totals.amount += reservation.quantity * reservation.product.price;
    return totals;
  }, { count: 0, amount: 0 });
  const earliestPickup = pickups
    .filter((pickup) => new Date(pickup.startAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
  const detailProduct = detailProductId ? offerProducts.find((product) => product.id === detailProductId) : null;

  function toggleFavorite(product: Product) {
    setFavoriteIds((current) => {
      const next = current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id];
      window.localStorage.setItem(`tdo:favorites:${user.id}`, JSON.stringify(next));
      return next;
    });
  }

  function openProductDetail(product: Product) {
    window.history.pushState({}, "", `/product/${product.id}`);
    setDetailProductId(product.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeProductDetail() {
    window.history.pushState({}, "", "/");
    setDetailProductId(null);
    setStoreView("catalog");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStoreView(nextView: StoreView) {
    if (detailProductId !== null) {
      window.history.pushState({}, "", "/");
      setDetailProductId(null);
    }
    setStoreView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="store-shell">
      <header className="store-topbar">
        <div className="store-brand-lockup">
          <div className="store-logo-column">
            <button className="logo-home-btn" onClick={() => goToStoreView("catalog")}><img className="header-logo" src="/assets/tunde-divat-online-logo.jpeg" alt="Tünde Divat Online" /></button>
            {onBackToAdmin && <button className="secondary mobile-admin-return" onClick={onBackToAdmin}>Vissza az adminba</button>}
          </div>
          <div className="store-user">
            <span>{user.username} | felhasználó</span>
            <strong>{storeView === "reservations" ? "Foglalásaim" : storeView === "favorites" ? "Kívánságlistám" : "Aktuális kínálat"}</strong>
            <div className="header-reservation-summary">
              <span>Lefoglalt termékek száma: <strong>{reservationTotals.count} db</strong></span>
              <span>Fizetendő: <strong>{formatHuf(reservationTotals.amount)}</strong></span>
            </div>
          </div>
        </div>
        <nav className="store-nav">
          <button className={storeView === "catalog" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("catalog")}>Aktuális kínálat</button>
          <button className={storeView === "reservations" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("reservations")}>
            Foglalásaim{reservationTotals.count > 0 ? ` (${reservationTotals.count})` : ""}
          </button>
          <button className={storeView === "favorites" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("favorites")}>
            Kívánságlistám{favoriteProducts.length > 0 ? ` (${favoriteProducts.length})` : ""}
          </button>
          {onBackToAdmin && <button className="secondary" onClick={onBackToAdmin}>Vissza az adminhoz</button>}
          <button className="ghost" onClick={logout}>Kijelentkezés</button>
        </nav>
      </header>
      <main className="store-main">
        {detailProduct ? (
          <ProductDetailPage
            product={detailProduct}
            pickups={pickups}
            reservations={reservations.filter((reservation) => reservation.productFk === detailProduct.id)}
            isFavorite={favoriteIds.includes(detailProduct.id)}
            earliestPickup={earliestPickup}
            onClose={closeProductDetail}
            onToggleFavorite={() => toggleFavorite(detailProduct)}
            onReserved={async () => {
              setMessage("A foglalás sikeres. Az admin felületen látszani fog, mit foglaltál; az átvételi időpont később is egyeztethető.");
              await loadStoreData();
            }}
          />
        ) : detailProductId ? (
          <section className="panel empty-state">
            <p>Ez a termék már nem elérhető.</p>
            <button className="secondary icon-text" onClick={closeProductDetail}><ArrowLeft size={18} /> Vissza a kínálathoz</button>
          </section>
        ) : storeView === "reservations" ? (
          <ReservationsPage
            reservations={reservations}
            pickups={pickups}
            tick={tick}
            onBackToCatalog={() => setStoreView("catalog")}
            onUpdatePickup={async (reservation, pickupId) => {
              await api(`/api/reservations/${reservation.id}/pickup`, {
                method: "PATCH",
                body: JSON.stringify({ pickup_id: pickupId })
              });
              setMessage("Az átvételi időpont módosítva.");
              await loadStoreData();
            }}
            onCancel={async (reservation) => {
              const confirmed = window.confirm("Biztosan lemondod ezt a foglalást? Foglalás után erre csak 10 percig van lehetőség, és ha ugyanezt a terméket később újra lefoglalod, azt már nem fogod tudni lemondani.");
              if (!confirmed) return;
              await api(`/api/reservations/${reservation.id}`, { method: "DELETE" });
              setMessage("A foglalást lemondtuk.");
              await loadStoreData();
            }}
          />
        ) : storeView === "favorites" ? (
          <>
            <section className="store-toolbar single-toolbar">
              <div>
                <h2>Kívánságlistám</h2>
                <span>{favoriteProducts.length} tétel</span>
              </div>
            </section>
            <ProductGrid
              products={favoriteProducts}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={openProductDetail}
              tick={tick}
            />
            {!favoriteProducts.length && <div className="panel empty-state">Még nincs termék a kívánságlistádon.</div>}
          </>
        ) : (
          <>
            <section className="store-hero">
              <div>
                <span className="store-eyebrow">Tünde Divat Online</span>
                <h1>Tündétől megszokott minőség, online kivitelben.</h1>
                <p>Válogassatok az aktuális kínálatból, adjátok le a foglalásotokat és válasszátok ki az átvétel helyét és idejét.</p>
              </div>
            </section>
            <section className="store-toolbar">
              <div>
                <h2>Aktuális kínálat</h2>
                <span>{visible.length} tétel</span>
              </div>
              <label className="search-field">
                <Search size={18} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keresés név, leírás alapján" />
              </label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Összes kategória</option>
                {categories.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </section>
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            <ProductGrid
              products={visible}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={openProductDetail}
              tick={tick}
            />
            {!visible.length && <div className="panel empty-state">Még nincs termék feltöltve. Hamarosan új árukészlettel jelentkezünk!</div>}
          </>
        )}
      </main>
      <nav className="mobile-store-nav" aria-label="Vásárlói gyorsnavigáció">
        <button className={storeView === "catalog" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("catalog")}>
          <ShoppingBag size={20} />
          <span>Aktuális kínálat</span>
        </button>
        <button className={storeView === "favorites" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("favorites")}>
          <Heart size={20} fill={storeView === "favorites" && !detailProductId ? "currentColor" : "none"} />
          <span>Kívánságlistám{favoriteProducts.length > 0 ? ` (${favoriteProducts.length})` : ""}</span>
        </button>
        <button className={storeView === "reservations" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("reservations")}>
          <FolderCheck size={20} />
          <span>Foglalásaim{reservationTotals.count > 0 ? ` (${reservationTotals.count})` : ""}</span>
        </button>
        <button onClick={logout}>
          <LogOut size={20} />
          <span>Kilépés</span>
        </button>
      </nav>
    </div>
  );
}

function ProductGrid({ products, favoriteIds, onToggleFavorite, onOpenDetail, tick }: {
  products: Product[];
  favoriteIds: number[];
  onToggleFavorite: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
  tick: number;
}) {
  return (
    <section className="store-grid">
      {products.map((product) => (
        <StoreProductCard
          product={product}
          isFavorite={favoriteIds.includes(product.id)}
          onToggleFavorite={() => onToggleFavorite(product)}
          onOpenDetail={() => onOpenDetail(product)}
          tick={tick}
          key={product.id}
        />
      ))}
    </section>
  );
}

function ReservationsPage({ reservations, pickups, tick, onBackToCatalog, onUpdatePickup, onCancel }: {
  reservations: Reservation[];
  pickups: PickupOption[];
  tick: number;
  onBackToCatalog: () => void;
  onUpdatePickup: (reservation: Reservation, pickupId: number) => Promise<void>;
  onCancel: (reservation: Reservation) => Promise<void>;
}) {
  const [previewImage, setPreviewImage] = useState("");
  const [busyReservationId, setBusyReservationId] = useState<number | null>(null);
  const totals = reservations.reduce((result, reservation) => {
    result.count += reservation.quantity;
    result.amount += reservation.quantity * reservation.product.price;
    return result;
  }, { count: 0, amount: 0 });
  async function updatePickup(reservation: Reservation, pickupId: number) {
    setBusyReservationId(reservation.id);
    try {
      await onUpdatePickup(reservation, pickupId);
    } finally {
      setBusyReservationId(null);
    }
  }
  return (
    <section className="panel reservations-panel">
      <div className="store-toolbar compact-toolbar">
        <div>
          <h2>Foglalásaim</h2>
          <span>{totals.count} db | {formatHuf(totals.amount)}</span>
        </div>
        <button className="secondary icon-text back-to-catalog-button" onClick={onBackToCatalog}>
          <ArrowLeft size={18} /> Vissza az aktuális kínálathoz
        </button>
      </div>
      <section className="pickup-panel">
        <div className="store-toolbar compact-toolbar">
          <h2>Személyes átvétel helye és ideje</h2>
        </div>
        <div className="empty-state">A kiválasztott átvételi időpontok a foglalások mellett jelennek meg.</div>
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Terméknév</th>
              <th>Kép</th>
              <th>Méret</th>
              <th>Fizetendő</th>
              <th>Átvétel helye</th>
              <th>Átvétel ideje</th>
              <th>Lemondható eddig</th>
              <th>Foglalás módosítása</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length ? reservations.map((reservation) => {
              const image = productDisplayImage(reservation.product);
              const url = imageUrl(image);
              return (
                <tr key={reservation.id}>
                  <td>{customerProductTitle(reservation.product)}</td>
                  <td>
                    {image ? (
                      <button className="image-preview-button" onClick={() => setPreviewImage(url)} aria-label="Termékkép nagyítása">
                        <img className="table-thumb" src={url} alt={`Foglalás ${reservation.product.displayNumber}`} />
                      </button>
                    ) : "-"}
                  </td>
                  <td>{reservation.color ? `${reservation.color}, ` : ""}{reservation.size}</td>
                  <td>{formatHuf(reservation.product.price * reservation.quantity)}</td>
                  <td>{pickupAddress(reservation.pickup)}</td>
                  <td>{pickupRangeText(reservation.pickup)}</td>
                  <td><span className={canCancelReservation(reservation) ? "cancel-countdown" : "cancel-countdown expired"}>{tick >= 0 ? formatCancelRemaining(reservation) : ""}</span></td>
                  <td>
                    <div className="reservation-edit-actions">
                      <select
                        className="status-select"
                        value={reservation.pickupFk ?? ""}
                        disabled={busyReservationId === reservation.id || pickups.length === 0}
                        onChange={(event) => updatePickup(reservation, Number(event.target.value))}
                      >
                        <option value="" disabled>Válassz átvételi időpontot</option>
                        {pickups.map((pickup) => (
                          <option value={pickup.id} key={pickup.id}>{pickup.address} | {formatPickupRange(pickup)}</option>
                        ))}
                      </select>
                      <button className="ghost table-action-btn" disabled={!canCancelReservation(reservation)} onClick={() => onCancel(reservation)}>
                        {canCancelReservation(reservation) ? "Foglalás lemondása" : "Nem lemondható"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8} className="empty-table-cell">Még nincs foglalásod.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {previewImage && (
        <button className="image-lightbox" onClick={() => setPreviewImage("")} aria-label="Nagyított termékkép bezárása">
          <img src={previewImage} alt="Nagyított termékkép" />
        </button>
      )}
    </section>
  );
}

function StoreProductCard({ product, isFavorite, onToggleFavorite, onOpenDetail, tick }: { product: Product; isFavorite: boolean; onToggleFavorite: () => void; onOpenDetail: () => void; tick: number }) {
  const displayImage = productDisplayImage(product);
  return (
    <article className="store-card">
      <div className="store-image-wrap">
        <button className="store-image-button" onClick={onOpenDetail}>
          <img src={imageUrl(displayImage)} alt={customerProductTitle(product)} />
        </button>
        <button className={`favorite-button ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite} aria-label={isFavorite ? "Eltávolítás a kívánságlistából" : "Kívánságlistához adás"}>
          <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="store-card-summary" onClick={onOpenDetail}>
        <span>{customerProductTitle(product)}</span>
        <strong>{formatHuf(product.price)}</strong>
        <small className="deadline-countdown">
          Foglalható eddig: <b className={isDeadlineUrgent(product.reservableUntil) ? "urgent" : ""}>{tick >= 0 ? formatRemaining(product.reservableUntil) : ""}</b>
        </small>
      </button>
    </article>
  );
}

function ProductDetailPage({ product, pickups, reservations, isFavorite, earliestPickup, onClose, onToggleFavorite, onReserved }: {
  product: Product;
  pickups: PickupOption[];
  reservations: Reservation[];
  isFavorite: boolean;
  earliestPickup?: PickupOption;
  onClose: () => void;
  onToggleFavorite: () => void;
  onReserved: () => Promise<void>;
}) {
  const galleryImages = [productDisplayImage(product), ...visibleProductShareImages(product)].filter((image, index, images): image is ProductImage => Boolean(image) && images.findIndex((candidate) => candidate?.id === image?.id) === index);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const displayImage = galleryImages[galleryIndex] ?? productDisplayImage(product);
  const colors = productColors(product);
  const [color, setColor] = useState(colors[0] ?? "");
  const sizes = sortedProductSizes(product, colors.length ? color : undefined);
  const [size, setSize] = useState(sizes[0]?.size ?? "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const activeReservation = reservations[0];
  const deadlineExpired = product.reservableUntil ? Date.now() > new Date(product.reservableUntil).getTime() : false;
  const selectedSizeLimit = sizes.find((item) => item.size === size)?.quantity ?? null;

  useEffect(() => {
    const nextColor = colors[0] ?? "";
    if (!colors.includes(color)) setColor(nextColor);
  }, [product.id]);

  useEffect(() => {
    if (!sizes.some((item) => item.size === size)) setSize(sizes[0]?.size ?? "");
  }, [product.id, color]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedSizeLimit !== null && quantity > selectedSizeLimit) {
      setQuantity(Math.max(1, selectedSizeLimit));
    }
  }, [quantity, selectedSizeLimit]);

  async function reserve() {
    setError("");
    if (!size) return setError("Válassz méretet a foglaláshoz.");
    if (selectedSizeLimit !== null && selectedSizeLimit <= 0) return setError("Ebből a méretből jelenleg nincs foglalható darab.");
    if (selectedSizeLimit !== null && quantity > selectedSizeLimit) return setError(`Ebből a méretből legfeljebb ${selectedSizeLimit} db foglalható.`);
    const selectedPickup = earliestPickup ?? pickups[0];
    const pickupLine = selectedPickup ? `${selectedPickup.address}, ${formatPickupRange(selectedPickup)}` : "Az átvételi időpontot később egyeztetjük.";
    const confirmed = window.confirm(
      `Kérjük, csak akkor erősítsd meg a foglalást, ha biztosan át tudod venni a terméket.\n\nTermék: ${customerProductTitle(product)}${colors.length ? `\nSzín: ${color}` : ""}\nMéret: ${size}\nDarabszám: ${quantity} db\nÁtvétel: ${pickupLine}\n\nMegerősíted a foglalást?`
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await api("/api/reservations", {
        method: "POST",
        body: JSON.stringify({ product_id: product.id, color: colors.length ? color : null, size, pickup_id: selectedPickup?.id ?? null, quantity })
      });
      await onReserved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A foglalás sikertelen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="product-detail-page">
      <button className="secondary icon-text detail-back-button" onClick={onClose}>
        <ArrowLeft size={18} /> Vissza a kínálathoz
      </button>
      <section className="product-detail">
        <div className="product-detail-image">
          <img src={imageUrl(displayImage)} alt={customerProductTitle(product)} />
          {galleryImages.length > 1 && <div className="product-gallery-controls">
            <button onClick={() => setGalleryIndex((value) => (value - 1 + galleryImages.length) % galleryImages.length)} aria-label="Előző kép"><ChevronLeft size={22} /></button>
            <span>{galleryIndex + 1} / {galleryImages.length}</span>
            <button onClick={() => setGalleryIndex((value) => (value + 1) % galleryImages.length)} aria-label="Következő kép"><ChevronRight size={22} /></button>
          </div>}
        </div>
        <div className="product-detail-info">
          <h2>{customerProductTitle(product)}</h2>
          <strong className="detail-price">{formatHuf(product.price)}</strong>
            <div className="quantity-row">
              <button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
              <span>{quantity}</span>
            <button disabled={selectedSizeLimit !== null && quantity >= selectedSizeLimit} onClick={() => setQuantity((value) => value + 1)}>+</button>
            <em>db</em>
          </div>
          {activeReservation ? (
            <p className="reserved own-reservation">Saját foglalás: {activeReservation.color ? `${activeReservation.color}, ` : ""}{activeReservation.size}, átvétel: {pickupRangeText(activeReservation.pickup)}</p>
          ) : (
          <div className="reserve-size-panel">
            {colors.length > 0 && <label>
              Szín
              <select value={color} onChange={(event) => setColor(event.target.value)}>
                {colors.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>}
            <label>
              Méret
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                {sizes.map((item) => <option value={item.size} key={item.size}>{item.size}{item.quantity != null ? ` - max. ${item.quantity} db` : ""}</option>)}
              </select>
            </label>
          </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="tdo-primary icon-text modal-reserve-button" disabled={busy || !!activeReservation || deadlineExpired || selectedSizeLimit === 0} onClick={reserve}>
            <ShoppingBag size={18} /> {deadlineExpired ? "A foglalási határidő lejárt" : activeReservation ? "Már lefoglalva" : selectedSizeLimit === 0 ? "Ez a méret elfogyott" : "Lefoglalom személyes átvételre"}
          </button>
          <div className="detail-facts">
            <div><span>Elérhető méretek:</span><strong className="detail-fact-value"><ProductSizeList product={product} /></strong></div>
            <div><span>Foglalható eddig:</span><strong className={isDeadlineUrgent(product.reservableUntil) ? "urgent" : ""}>{tick >= 0 ? formatRemaining(product.reservableUntil) : ""}</strong></div>
            <div><span>Várható szállítás:</span><strong className="detail-fact-value">{formatDateOnly(earliestPickup?.startAt)}</strong></div>
          </div>
          <button className={`wishlist-row ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite}>
            <Heart size={24} fill={isFavorite ? "currentColor" : "none"} />
            {isFavorite ? "Hozzáadtad a kívánságlistához." : "Kívánságlistára teszem"}
          </button>
        </div>
      </section>
    </section>
  );
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<AdminView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setIsStandalone(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const adminViewOrder: { id: AdminView; label: string }[] = [
    { id: "quick", label: "0. Gyors feltöltés" },
    { id: "new", label: "1. Új termék" },
    { id: "ai", label: "2. AI-generálás" },
    { id: "share", label: "3. Megosztás" },
    { id: "current", label: "4. Jelenlegi kínálat" },
    { id: "orders", label: "5. Rendelők és rendelések" },
    { id: "pickup", label: "6. Személyes átvétel megadása" },
    { id: "deleted", label: "Törölt tételek" },
    { id: "users", label: "Regisztrált felhasználók" }
  ];
  const mobileViewIndex = adminViewOrder.findIndex((item) => item.id === view);
  const mobileViewLabel = mobileViewIndex >= 0 ? adminViewOrder[mobileViewIndex].label : "";

  function jumpMobileView(direction: -1 | 1) {
    if (mobileViewIndex < 0) return;
    const nextIndex = (mobileViewIndex + direction + adminViewOrder.length) % adminViewOrder.length;
    setView(adminViewOrder[nextIndex].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    onLogout();
  }
  if (view === "storefront") {
    return <CustomerStorefront user={user} onLogout={onLogout} onBackToAdmin={() => setView("dashboard")} />;
  }
  return (
    <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${isStandalone ? "pwa-mode" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <div>
            <strong>Tünde Divat Online</strong>
            <span>{user.username}</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Menü megnyitása" : "Menü becsukása"}>
            {sidebarCollapsed ? <Menu size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        <nav>
          <button onClick={() => setView("dashboard")} className={view === "dashboard" ? "active" : ""}>Dashboard</button>
          <button onClick={() => setView("quick")} className={view === "quick" ? "active" : ""}>0. Gyors feltöltés</button>
          <button onClick={() => setView("new")} className={view === "new" ? "active" : ""}>1. Új termék</button>
          <button onClick={() => setView("ai")} className={view === "ai" ? "active" : ""}>2. AI-generálás</button>
          <button onClick={() => setView("share")} className={view === "share" ? "active" : ""}>3. Megosztás</button>
          <button onClick={() => setView("current")} className={view === "current" ? "active" : ""}>4. Jelenlegi kínálat</button>
          <button onClick={() => setView("orders")} className={view === "orders" ? "active" : ""}>5. Rendelők és rendelések</button>
          <button onClick={() => setView("pickup")} className={view === "pickup" ? "active" : ""}>6. Személyes átvétel megadása</button>
          <button onClick={() => setView("storefront")} className="nav-storefront">Felhasználói nézet</button>
          <button onClick={() => setView("deleted")} className={`nav-deleted ${view === "deleted" ? "active" : ""}`}>Törölt tételek</button>
          <button onClick={() => setView("users")} className={view === "users" ? "active" : ""}>Regisztrált felhasználók</button>
        </nav>
        <button className="ghost icon-text" onClick={logout}><LogOut size={18} /> Kilépés</button>
      </aside>
      <main className="content">
        {mobileViewIndex >= 0 && (
          <div className="mobile-view-switcher" aria-label="Dashboard nézetváltó">
            <button className="secondary" onClick={() => jumpMobileView(-1)} aria-label="Előző admin ablak">
              <ChevronLeft size={20} />
            </button>
            <strong>{mobileViewLabel}</strong>
            <button className="secondary" onClick={() => jumpMobileView(1)} aria-label="Következő admin ablak">
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        {view !== "dashboard" && (
          <button className="secondary icon-text admin-back-button" onClick={() => setView("dashboard")}>
            <ArrowLeft size={18} /> Vissza a főmenübe
          </button>
        )}
        {view === "dashboard" && <Dashboard onQuick={() => setView("quick")} onNew={() => setView("new")} onStorefront={() => setView("storefront")} onAi={() => setView("ai")} onShare={() => setView("share")} onCurrent={() => setView("current")} onOrders={() => setView("orders")} onPickup={() => setView("pickup")} />}
        {view === "quick" && <QuickUpload onDone={() => setView("share")} onAi={() => setView("ai")} />}
        {view === "new" && <ProductWizard onDone={() => setView("ai")} />}
        {view === "ai" && <AiGenerationQueue />}
        {view === "share" && <ShareCenter />}
        {view === "current" && <CurrentOfferings />}
        {view === "orders" && <Orders />}
        {view === "pickup" && <PickupSettings />}
        {view === "deleted" && <DeletedProducts />}
        {view === "users" && <RegisteredUsers />}
      </main>
    </div>
  );
}

function PwaInstallPanel() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setMessage("");
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setMessage("Az app telepítve van ezen az eszközön.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installed) {
      setMessage("Az app már telepített nézetben fut.");
      return;
    }
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      setMessage(choice.outcome === "accepted" ? "Telepítés elindítva." : "A telepítést most kihagytad.");
      return;
    }
    setMessage("iPhone-on: Safari megosztás ikon, majd Hozzáadás a Főképernyőhöz. Androidon: Chrome menü, majd Alkalmazás telepítése.");
  }

  return (
    <section className="panel pwa-install-panel">
      <div>
        <span>Telefonos admin app</span>
        <strong>{installed ? "Telepített nézet aktív" : "App telepítése telefonra"}</strong>
      </div>
      <button className="tdo-primary icon-text" onClick={install}>
        <Download size={22} /> {installed ? "Megnyitva appként" : "App telepítése telefonra"}
      </button>
      {message && <p className="status-note">{message}</p>}
    </section>
  );
}

function Dashboard({ onQuick, onNew, onStorefront, onAi, onShare, onCurrent, onOrders, onPickup }: { onQuick: () => void; onNew: () => void; onStorefront: () => void; onAi: () => void; onShare: () => void; onCurrent: () => void; onOrders: () => void; onPickup: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  useEffect(() => {
    api<{ products: Product[] }>("/api/products").then((res) => setProducts(res.products));
  }, []);
  useEffect(() => {
    if (!inviteOpen) return;
    api<{ invite_code: string }>("/api/auth/invite-code")
      .then((res) => setInviteCode(res.invite_code))
      .catch((err) => setInviteError(err instanceof Error ? err.message : "A meghívókód betöltése sikertelen."));
  }, [inviteOpen]);

  async function saveInviteCode(event: React.FormEvent) {
    event.preventDefault();
    setInviteError("");
    setInviteMessage("");
    try {
      const res = await api<{ invite_code: string }>("/api/auth/invite-code", {
        method: "PUT",
        body: JSON.stringify({ invite_code: inviteCode })
      });
      setInviteCode(res.invite_code);
      setInviteMessage("Meghívókód mentve.");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "A meghívókód mentése sikertelen.");
    }
  }
  const waitingForAi = products.filter((product) => product.status === "DRAFT" && productOriginalImages(product).some((image) => image.viewType !== "OTHER"));
  const aiGenerated = products.filter((product) => product.images.some((image) => image.imageType === "AI_GENERATED"));
  const current = products.filter((product) => product.status === "APPROVED");
  return (
    <>
      <header className="topbar">
        <h1>Dashboard</h1>
      </header>
      <div className="dashboard-actions">
        <button className="storefront-cta storefront-dashboard-cta icon-text" onClick={onStorefront}><Eye size={26} /> Felhasználói nézet</button>
      </div>
      <div className="dashboard-actions dashboard-main-actions">
        <button className="quick-upload-cta icon-text" onClick={onQuick}><Camera size={30} /> 0. Gyors feltöltés</button>
        <button className="new-product-cta primary icon-text" onClick={onNew}><Plus size={30} /> 1. Új termék</button>
      </div>
      <section className="dashboard-list">
        <button className="dashboard-row" onClick={onAi}>
          <span>2. AI-generálásra vár</span>
          <strong>{waitingForAi.length}</strong>
        </button>
        <button className="dashboard-row" onClick={onShare}>
          <span>3. Megosztható képek</span>
          <strong>{aiGenerated.length}</strong>
        </button>
        <button className="dashboard-row" onClick={onCurrent}>
          <span>4. Jelenlegi kínálat</span>
          <strong>{current.length}</strong>
        </button>
        <button className="dashboard-row" onClick={onOrders}>
          <span>5. Rendelők és rendelések</span>
          <strong>→</strong>
        </button>
        <button className="dashboard-row" onClick={onPickup}>
          <span>6. Személyes átvétel megadása</span>
          <strong>→</strong>
        </button>
      </section>
      <section className="panel invite-panel">
        <button className="secondary icon-text" onClick={() => setInviteOpen((value) => !value)}>
          <KeyRound size={18} /> Meghívókód megadása
        </button>
        {inviteOpen && (
          <form className="invite-form" onSubmit={saveInviteCode}>
            <label>
              Meghívókód
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} type="text" />
            </label>
            {inviteError && <p className="error">{inviteError}</p>}
            {inviteMessage && <p className="success">{inviteMessage}</p>}
            <button className="primary" type="submit">Mentés</button>
          </form>
        )}
        <PwaInstallPanel />
      </section>
    </>
  );
}

function sizeQuantityPayload(sizes: string[], quantities: Record<string, string>) {
  return Object.fromEntries(
    sizes
      .map((size) => [size, quantities[size]?.trim()] as const)
      .filter(([, quantity]) => quantity !== undefined && quantity !== "")
      .map(([size, quantity]) => [size, Number(quantity)])
  );
}

type ColorVariantForm = {
  color: string;
  sizes: string[];
  quantities: Record<string, string>;
};

function colorVariantPayload(variants: ColorVariantForm[]) {
  return variants.map((variant) => ({
    color: variant.color.trim(),
    sizes: variant.sizes.map((size) => ({
      size,
      quantity: variant.quantities[size]?.trim() ? Number(variant.quantities[size]) : null
    }))
  }));
}

function productFormError(form: {
  price: string;
  available_sizes: string[];
  size_quantities: Record<string, string>;
  color_variants?: ColorVariantForm[];
}) {
  if (!form.price.trim()) return "Az ár megadása kötelező.";
  const price = Number(form.price);
  if (!Number.isFinite(price) || price <= 0) return "Az ár nullánál nagyobb szám legyen.";
  const variants = form.color_variants ?? [];
  if (variants.length) {
    const usedColors = new Set<string>();
    for (const variant of variants) {
      const color = variant.color.trim();
      if (!color) return "Minden színváltozatnak adj nevet.";
      const normalized = color.toLocaleLowerCase("hu-HU");
      if (usedColors.has(normalized)) return "Egy színt csak egyszer adj meg.";
      usedColors.add(normalized);
      if (!variant.sizes.length) return `A(z) ${color} színhez legalább egy méretet válassz ki.`;
      const invalidQuantity = variant.sizes.find((size) => {
        const value = variant.quantities[size]?.trim();
        if (!value) return false;
        const quantity = Number(value);
        return !Number.isInteger(quantity) || quantity < 0;
      });
      if (invalidQuantity) return `${color} / ${invalidQuantity} méretnél a maximum darabszám 0 vagy annál nagyobb egész szám legyen.`;
    }
    return "";
  }
  if (!form.available_sizes.length) return "Legalább egy méretet válassz ki.";
  const invalidQuantity = form.available_sizes.find((size) => {
    const value = form.size_quantities[size]?.trim();
    if (!value) return false;
    const quantity = Number(value);
    return !Number.isInteger(quantity) || quantity < 0;
  });
  if (invalidQuantity) return `${invalidQuantity} méretnél a maximum darabszám 0 vagy annál nagyobb egész szám legyen.`;
  return "";
}

function PhotoAspectList({ previews, viewTypes, onViewTypeChange, onRemove }: {
  previews: string[];
  viewTypes: ImageViewType[];
  onViewTypeChange: (index: number, viewType: ImageViewType) => void;
  onRemove?: (index: number) => void;
}) {
  return <div className="upload-preview-list">
    {previews.map((preview, index) => {
      const viewType = viewTypes[index] ?? "AUTO";
      return <div key={preview} className="upload-preview-item">
        <img src={preview} alt={`Feltöltött kép ${index + 1}`} />
        <label>
          <span>{index + 1}. kép nézete</span>
          <select value={viewType} onChange={(event) => onViewTypeChange(index, event.target.value as ImageViewType)}>
            {imageViewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {imageViewOptions.find((option) => option.value === viewType)?.hint && <small>{imageViewOptions.find((option) => option.value === viewType)?.hint}</small>}
        </label>
        {onRemove && <button type="button" onClick={() => onRemove(index)} aria-label={`Kép ${index + 1} törlése`}>×</button>}
      </div>;
    })}
  </div>;
}

function QuickUpload({ onDone, onAi }: { onDone: () => void; onAi: () => void }) {
  const inputId = "quick-camera-input";
  const [step, setStep] = useState<"camera" | "confirm" | "data" | "saved">("camera");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [viewTypes, setViewTypes] = useState<ImageViewType[]>([]);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    product_name: "",
    price: "",
    available_sizes: [] as string[]
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step !== "camera") return;
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    window.setTimeout(() => input?.click(), 120);
  }, [step]);

  function resetCamera() {
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles([]);
    setPreviews([]);
    setViewTypes([]);
    setError("");
    setStep("camera");
  }

  function pick(next: File | null) {
    if (!next) return;
    if (files.length >= 5) return setError("Egy termékhez legfeljebb 5 képet tölthetsz fel.");
    setFiles((current) => [...current, next]);
    setPreviews((current) => [...current, URL.createObjectURL(next)]);
    setViewTypes((current) => [...current, "AUTO"]);
    setError("");
    setStep("confirm");
  }

  async function saveQuickProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!files.length) return setError("Készíts vagy válassz egy fotót a gyors feltöltéshez.");
    if (!form.product_name.trim()) return setError("Add meg a termék nevét.");
    const validationError = productFormError({
      price: form.price,
      available_sizes: form.available_sizes,
      size_quantities: {}
    });
    if (validationError) return setError(validationError);
    setBusy(true);
    setError("");
    try {
      const created = await api<{ product: Product }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          product_id: null,
          product_name: form.product_name.trim(),
          price: Number(form.price),
          available_sizes: form.available_sizes,
          size_quantities: {},
          category: null,
          description: null,
          reservable_until: null,
          reservable_duration_hours: 12
        })
      });
      let uploadedProduct = created.product;
      for (const [index, file] of files.entries()) {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("view_type", viewTypes[index] ?? "AUTO");
        const uploaded = await api<{ product: Product }>(`/api/products/${created.product.id}/image`, { method: "POST", body: fd });
        uploadedProduct = uploaded.product;
      }
      setSavedProduct(uploadedProduct);
      setStep("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "A gyors feltöltés sikertelen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wizard quick-upload">
      <header className="topbar">
        <h1>Gyors feltöltés</h1>
      </header>
      {error && <p className="error">{error}</p>}
      <input
        id={inputId}
        hidden
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        onClick={(event) => { event.currentTarget.value = ""; }}
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />
      {step === "camera" && (
        <section className="panel quick-camera-panel">
          <Camera size={48} />
          <h2>Kamera megnyitása</h2>
          <p>Ha a kamera nem nyílt meg automatikusan, indítsd el innen. PWA nézetben ez a telefon kameráját fogja használni.</p>
          <label className="quick-camera-button icon-text" htmlFor={inputId}>
            <Camera size={24} /> Fotó készítése
          </label>
        </section>
      )}
      {step === "confirm" && (
        <section className="panel quick-confirm-panel">
          <div className="quick-preview"><PhotoAspectList previews={previews} viewTypes={viewTypes} onViewTypeChange={(index, viewType) => setViewTypes((current) => current.map((item, itemIndex) => itemIndex === index ? viewType : item))} /></div>
          <div className="quick-confirm-actions">
            <h2>{files.length} / 5 kép kiválasztva</h2>
            <button className="primary icon-text" onClick={() => setStep("data")}>
              <Upload size={20} /> Adatok megadása
            </button>
            <label className="secondary icon-text quick-camera-button">
              <Camera size={20} /> További kép feltöltése
              <input hidden type="file" accept="image/*,.heic,.heif" capture="environment" disabled={files.length >= 5} onChange={(event) => pick(event.target.files?.[0] ?? null)} />
            </label>
          </div>
        </section>
      )}
      {step === "data" && (
        <form className="panel quick-data-panel" onSubmit={saveQuickProduct}>
          <div>
            <h2>Gyors adatok</h2>
            <p>Leírás nélkül mentjük. A foglalási határidő automatikusan +12 óra lesz a honlapra megosztástól számítva.</p>
          </div>
          <Text label="Termék megnevezése" value={form.product_name} onChange={(product_name) => setForm({ ...form, product_name })} />
          <Text label="Ár (Ft)" type="number" value={form.price} onChange={(price) => setForm({ ...form, price })} />
          <SizePicker value={form.available_sizes} onChange={(available_sizes) => setForm({ ...form, available_sizes })} />
          <div className="button-row wide">
            <button className="secondary" type="button" onClick={() => setStep("confirm")}>Vissza a képhez</button>
            <button className="primary" disabled={busy} type="submit">{busy ? "Mentés..." : "Mentés megosztásba"}</button>
          </div>
        </form>
      )}
      {step === "saved" && savedProduct && (
        <section className="panel quick-saved-panel">
          <FolderCheck size={44} />
          <h2>Gyors feltöltés mentve</h2>
          <p>Az eredeti kép bekerült a Megosztás AI nélküli képei közé, és AI-generálásra is várakozik.</p>
          <dl>
            <dt>Termék</dt><dd>{savedProduct.productName}</dd>
            <dt>Product ID</dt><dd>{savedProduct.productId}</dd>
            <dt>Határidő</dt><dd>+12 óra a honlapra megosztástól</dd>
          </dl>
          <div className="button-row">
            <button className="secondary" onClick={resetCamera}>Új gyors feltöltés</button>
            <button className="secondary" onClick={onAi}>AI-generálás</button>
            <button className="primary" onClick={onDone}>Megosztás megnyitása</button>
          </div>
        </section>
      )}
    </section>
  );
}

function ProductWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("photo");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [viewTypes, setViewTypes] = useState<ImageViewType[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    product_id: "",
    product_name: "",
    price: "",
    available_sizes: [] as string[],
    size_quantities: {} as Record<string, string>,
    color_variants: [] as ColorVariantForm[],
    category: "",
    description: "",
    reservable_until: "",
    reservable_duration_hours: "24",
    no_expiry: false
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pick(next: FileList | null) {
    const selected = next ? Array.from(next) : [];
    if (!selected.length) return;
    const availableSlots = Math.max(0, 5 - files.length);
    const accepted = selected.slice(0, availableSlots);
    if (!accepted.length) return setError("Egy termékhez legfeljebb 5 képet tölthetsz fel.");
    if (accepted.length < selected.length) setError("Egy termékhez legfeljebb 5 képet tölthetsz fel; a többi kép nem került hozzáadásra.");
    setFiles((current) => [...current, ...accepted]);
    setPreviews((current) => [...current, ...accepted.map((file) => URL.createObjectURL(file))]);
    setViewTypes((current) => [...current, ...accepted.map((): ImageViewType => "AUTO")]);
  }

  async function createAndUpload() {
    const validationError = productFormError(form);
    if (validationError) return setError(validationError);
    setBusy(true);
    setError("");
    try {
      const created = await api<{ product: Product }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          product_id: form.product_id || null,
          product_name: form.product_name || null,
          price: Number(form.price),
          category: form.category || null,
          available_sizes: form.color_variants.length ? [] : form.available_sizes,
          size_quantities: form.color_variants.length ? {} : sizeQuantityPayload(form.available_sizes, form.size_quantities),
          color_variants: form.color_variants.length ? colorVariantPayload(form.color_variants) : undefined,
          reservable_until: form.no_expiry || !form.reservable_until ? null : new Date(form.reservable_until).toISOString(),
          reservable_duration_hours: form.no_expiry || form.reservable_until ? null : Number(form.reservable_duration_hours)
        })
      });
      let uploadedProduct = created.product;
      for (const [index, file] of files.entries()) {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("view_type", viewTypes[index] ?? "AUTO");
        const uploaded = await api<{ product: Product }>(`/api/products/${created.product.id}/image`, { method: "POST", body: fd });
        uploadedProduct = uploaded.product;
      }
      setProduct(uploadedProduct);
      setStep("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentési hiba");
    } finally {
      setBusy(false);
    }
  }

  const original = product?.images.find((img) => img.imageType === "ORIGINAL");

  return (
    <section className="wizard">
      <header className="topbar">
        <h1>Új termék</h1>
      </header>
      <Stepper step={step} />
      {error && <p className="error">{error}</p>}
      {step === "photo" && (
        <div className="panel">
          <div className="photo-actions">
            <label className="photo-action icon-text">
              <Camera size={34} /> Fotó készítése
              <input hidden type="file" accept="image/*,.heic,.heif" capture="environment" onChange={(e) => pick(e.target.files)} />
            </label>
            <label className="photo-action secondary icon-text">
              <Upload size={34} /> Kép feltöltése
              <input hidden type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => pick(e.target.files)} />
            </label>
          </div>
          <div className="upload-zone">
            {previews.length ? <PhotoAspectList previews={previews} viewTypes={viewTypes} onViewTypeChange={(index, viewType) => setViewTypes((current) => current.map((item, itemIndex) => itemIndex === index ? viewType : item))} onRemove={(index) => { const preview = previews[index]; URL.revokeObjectURL(preview); setPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index)); setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); setViewTypes((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} /> : <Camera size={44} />}
          </div>
          {files.length > 0 && <label className="secondary add-more-photos"><Upload size={18} /> {files.length >= 5 ? "Elérted az 5 képes maximumot" : "További kép feltöltése?"}<input hidden type="file" accept="image/*,.heic,.heif" multiple disabled={files.length >= 5} onChange={(e) => pick(e.target.files)} /></label>}
          <button className="primary upload-next" onClick={() => setStep("data")}>
            {files.length ? `${files.length} kép kiválasztva - adatok megadása` : "Tovább az adatokhoz kép nélkül"}
          </button>
        </div>
      )}
      {step === "data" && (
        <div className="panel form-grid product-data-form">
          <Text label="Product ID" value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
          <Text label="Termék megnevezése" value={form.product_name} onChange={(product_name) => setForm({ ...form, product_name })} />
          <Text label="Ár (Ft)" type="number" value={form.price} onChange={(price) => setForm({ ...form, price })} />
          {form.color_variants.length ? (
            <ColorVariantFields variants={form.color_variants} onChange={(color_variants) => setForm({ ...form, color_variants })} />
          ) : (
            <>
              <SizePicker value={form.available_sizes} onChange={(available_sizes) => setForm({ ...form, available_sizes })} />
              <SizeQuantityFields
                sizes={form.available_sizes}
                quantities={form.size_quantities}
                onChange={(size, quantity) => setForm({ ...form, size_quantities: { ...form.size_quantities, [size]: quantity } })}
              />
              <button className="secondary icon-text color-mode-button" type="button" onClick={() => setForm({ ...form, available_sizes: [], size_quantities: {}, color_variants: [{ color: "", sizes: [], quantities: {} }] })}>
                <Plus size={18} /> Színenkénti méretek és készlet megadása
              </button>
            </>
          )}
          <CategoryPicker value={form.category} onChange={(category) => setForm({ ...form, category })} />
          <ReservationDeadlinePicker
            durationHours={form.reservable_duration_hours}
            customDate={form.reservable_until}
            noExpiry={form.no_expiry}
            onDuration={(reservable_duration_hours) => setForm({ ...form, reservable_duration_hours, reservable_until: "" })}
            onCustomDate={(reservable_until) => setForm({ ...form, reservable_until })}
            onNoExpiry={(no_expiry) => setForm({ ...form, no_expiry, reservable_until: no_expiry ? "" : form.reservable_until })}
          />
          <label className="wide">
            Leírás
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="button-row wide">
            <button className="secondary" onClick={() => setStep("photo")}>Vissza</button>
            <button className="primary" disabled={busy} onClick={createAndUpload}>Mentés és tovább az AI-generáláshoz</button>
          </div>
        </div>
      )}
      {step === "saved" && product && (
        <div className="panel summary">
          {original ? <img src={imageUrl(original)} alt="Eredeti kép" /> : <div className="empty-state">Ehhez a termékhez még nincs feltöltött kép.</div>}
          <div>
            <h2>Termék mentve</h2>
            <dl>
              <dt>Product ID</dt><dd>{product.productId}</dd>
              <dt>Termék megnevezése</dt><dd>{product.productName || "-"}</dd>
              <dt>Publikus sorszám</dt><dd>Honlapra megosztáskor kapja meg.</dd>
              <dt>Ár</dt><dd>{formatHuf(product.price)}</dd>
              <dt>Méretek</dt><dd>{formatProductSizes(product, true)}</dd>
            </dl>
            <div className="button-row">
              <button className="secondary" onClick={() => setStep("data")}>Adatok módosítása</button>
              <button className="primary" onClick={onDone}>Tovább az AI-generáláshoz</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["photo", "data", "saved"];
  const labels = ["Fotó", "Adatok", "Mentve"];
  const index = order.indexOf(step);
  return <ol className="stepper">{labels.map((label, i) => <li className={i <= index ? "done" : ""} key={label}>{label}</li>)}</ol>;
}

function Text({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function ReservationDeadlinePicker({ durationHours, customDate, noExpiry, onDuration, onCustomDate, onNoExpiry }: {
  durationHours: string;
  customDate: string;
  noExpiry: boolean;
  onDuration: (hours: string) => void;
  onCustomDate: (date: string) => void;
  onNoExpiry: (enabled: boolean) => void;
}) {
  const options = ["2", "4", "6", "12", "24", "36", "48"];
  return (
    <fieldset className="deadline-picker wide">
      <legend>Foglalható eddig</legend>
      <p>A gyorsgombos határidő a honlapra megosztás pillanatától indul.</p>
      <label className="checkbox-line">
        <input type="checkbox" checked={noExpiry} onChange={(event) => onNoExpiry(event.target.checked)} />
        Határidő nélkül foglalható
      </label>
      <div className="deadline-buttons">
        {options.map((hours) => (
          <button
            type="button"
            className={!noExpiry && !customDate && durationHours === hours ? "active" : ""}
            disabled={noExpiry}
            onClick={() => {
              onNoExpiry(false);
              onDuration(hours);
            }}
            key={hours}
          >
            +{hours} óra
          </button>
        ))}
      </div>
      <label>
        Egyedi dátum és idő
        <input
          type="datetime-local"
          value={customDate}
          disabled={noExpiry}
          onChange={(event) => {
            onNoExpiry(false);
            onCustomDate(event.target.value);
          }}
        />
      </label>
    </fieldset>
  );
}

function CategoryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const categories = ["Kabát", "Nadrág", "Póló", "Ruha", "Felső", "Cipő", "Harisnya", "Táska", "Sapka"];
  const selectValue = categories.includes(value) || !value ? value : "custom";
  return (
    <fieldset className="category-picker wide">
      <legend>Kategória</legend>
      <select value={selectValue} onChange={(event) => onChange(event.target.value === "custom" ? "" : event.target.value)}>
        <option value="">Automatikus felismerés</option>
        {categories.map((category) => <option value={category} key={category}>{category}</option>)}
        <option value="custom">Egyéb - saját megnevezés</option>
      </select>
      {selectValue === "custom" && <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Írd be a kategóriát" />}
      {!value && <small>Ha üresen hagyod, a termék neve és leírása alapján automatikusan soroljuk be.</small>}
    </fieldset>
  );
}

function SizePicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset className="size-picker wide">
      <legend>Méretek</legend>
      {allowedSizes.map((size) => (
        <label key={size} className={value.includes(size) ? "selected" : ""}>
          <input
            type="checkbox"
            checked={value.includes(size)}
            onChange={() => onChange(value.includes(size) ? value.filter((item) => item !== size) : [...value, size])}
          />
          {size}
        </label>
      ))}
    </fieldset>
  );
}

function SizeQuantityFields({ sizes, quantities, onChange }: {
  sizes: string[];
  quantities: Record<string, string>;
  onChange: (size: string, quantity: string) => void;
}) {
  const sortedSizes = [...sizes].sort((a, b) => allowedSizes.indexOf(a as (typeof allowedSizes)[number]) - allowedSizes.indexOf(b as (typeof allowedSizes)[number]));
  if (!sortedSizes.length) return null;
  return (
    <fieldset className="size-quantity-fields wide">
      <legend>Méret maximumok</legend>
      <p>Üresen hagyva az adott méret korlátlanul foglalható.</p>
      <div className="size-quantity-grid">
        {sortedSizes.map((size) => (
          <label key={size}>
            <span>{size}</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Korlátlan"
              value={quantities[size] ?? ""}
              onChange={(event) => onChange(size, event.target.value)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ColorVariantFields({ variants, onChange }: { variants: ColorVariantForm[]; onChange: (variants: ColorVariantForm[]) => void }) {
  function update(index: number, next: Partial<ColorVariantForm>) {
    onChange(variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...next } : variant));
  }

  return (
    <fieldset className="color-variant-fields wide">
      <legend>Színenkénti méretek és készlet</legend>
      <p>Színváltozat esetén a méreteket és a darabszámot színenként add meg. Az üres darabszám korlátlan készletet jelent.</p>
      {variants.map((variant, index) => (
        <section className="color-variant-card" key={index}>
          <div className="color-variant-head">
            <label>
              Szín megnevezése
              <input value={variant.color} onChange={(event) => update(index, { color: event.target.value })} placeholder="Például bordó" />
            </label>
            <button className="danger icon-text" type="button" onClick={() => onChange(variants.filter((_, variantIndex) => variantIndex !== index))}>
              <Trash2 size={17} /> Szín törlése
            </button>
          </div>
          <SizePicker value={variant.sizes} onChange={(sizes) => update(index, { sizes })} />
          <SizeQuantityFields
            sizes={variant.sizes}
            quantities={variant.quantities}
            onChange={(size, quantity) => update(index, { quantities: { ...variant.quantities, [size]: quantity } })}
          />
        </section>
      ))}
      <button className="secondary icon-text color-variant-add" type="button" onClick={() => onChange([...variants, { color: "", sizes: [], quantities: {} }])}>
        <Plus size={18} /> Új szín hozzáadása
      </button>
    </fieldset>
  );
}

function ImageVisibilityEditor({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [images, setImages] = useState(() => productShareImages(product));
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const imagesRef = useRef(images);
  const dragMoved = useRef(false);

  useEffect(() => {
    const next = productShareImages(product);
    imagesRef.current = next;
    setImages(next);
  }, [product]);

  if (!images.length) return null;

  function setImageOrder(next: ProductImage[]) {
    imagesRef.current = next;
    setImages(next);
  }

  function reorder(sourceId: number, targetId: number) {
    const current = imagesRef.current;
    const sourceIndex = current.findIndex((image) => image.id === sourceId);
    const targetIndex = current.findIndex((image) => image.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
    const next = [...current];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    setImageOrder(next);
    return next;
  }

  async function saveOrder(order = imagesRef.current) {
    setOrderBusy(true);
    setOrderError("");
    try {
      await api(`/api/products/${product.id}/images/order`, { method: "PUT", body: JSON.stringify({ image_ids: order.map((image) => image.id) }) });
      onSaved();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "A képsorrend mentése sikertelen.");
    } finally {
      setOrderBusy(false);
    }
  }

  async function toggle(image: ProductImage) {
    setBusyId(image.id);
    try {
      await api(`/api/products/${product.id}/images/${image.id}/visibility`, { method: "PUT", body: JSON.stringify({ is_hidden: !image.isHidden }) });
      onSaved();
    } finally {
      setBusyId(null);
    }
  }
  return <section className="image-visibility-editor">
    <strong>Képek sorrendje és láthatósága</strong>
    <p>Koppints egy képre vagy a jobb alsó tiltás ikonra az elrejtéséhez. Nyomva tartva húzással, gépen egérrel rendezheted a sorrendet.</p>
    <div className="visibility-image-grid">
      {images.map((image) => <div
        className={`${image.isHidden ? "hidden-image " : ""}${draggedId === image.id ? "image-being-dragged" : ""}`}
        data-share-image-id={image.id}
        draggable={!orderBusy}
        key={image.id}
        onDragStart={() => { dragMoved.current = true; setDraggedId(image.id); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); if (draggedId != null) void saveOrder(reorder(draggedId, image.id)); setDraggedId(null); }}
        onDragEnd={() => setDraggedId(null)}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" && !orderBusy) {
            dragMoved.current = false;
            setDraggedId(image.id);
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || draggedId == null) return;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-share-image-id]");
          const targetId = Number(target?.dataset.shareImageId);
          if (targetId && targetId !== draggedId) {
            dragMoved.current = true;
            reorder(draggedId, targetId);
          }
        }}
        onPointerUp={() => {
          if (draggedId != null && dragMoved.current) void saveOrder();
          setDraggedId(null);
        }}
      >
        <img src={imageUrl(image)} alt={image.imageType === "ORIGINAL" ? "Eredeti termékkép" : "AI-generált termékkép"} onClick={() => { if (!dragMoved.current) void toggle(image); dragMoved.current = false; }} />
        <span>{image.imageType === "ORIGINAL" ? "Eredeti" : "AI"}</span>
        <button type="button" className={image.isHidden ? "visibility-toggle restore" : "visibility-toggle"} disabled={busyId === image.id} onClick={(event) => { event.stopPropagation(); void toggle(image); }} aria-label={image.isHidden ? "Kép megjelenítése" : "Kép elrejtése"}>
          {image.isHidden ? <Eye size={18} /> : <Ban size={18} />}
        </button>
      </div>)}
    </div>
    {orderBusy && <p>Képsorrend mentése...</p>}
    {orderError && <p className="error">{orderError}</p>}
  </section>;
}

function AiGenerationQueue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(activeAiBatch.running);
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await api<{ products: Product[] }>("/api/products?status=DRAFT");
    const queue = res.products.filter((product) => productOriginalImages(product).some((image) => image.viewType !== "OTHER"));
    setProducts(queue);
    const imageIds = queue.flatMap((product) => productOriginalImages(product).filter((image) => !image.isHidden && image.viewType !== "OTHER").map((image) => image.id));
    setSelectedImageIds((current) => current.length ? current.filter((id) => imageIds.includes(id)) : imageIds);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setBulkBusy(activeAiBatch.running), 300);
    return () => window.clearInterval(timer);
  }, []);

  async function generate(product: Product, gender: ModelGender, imageId?: number, signal?: AbortSignal) {
    setBusyId(product.id);
    setMessage("");
    setError("");
    try {
      await api<{ product: Product }>(`/api/products/${product.id}/generate`, {
        method: "POST",
        body: JSON.stringify({ gender, image_id: imageId }),
        signal
      });
      await load();
    } catch (err) {
      if (signal?.aborted) throw err;
      setError(err instanceof Error ? err.message : "Generálási hiba");
    } finally {
      setBusyId(null);
    }
  }

  async function generateAll(gender: ModelGender) {
    if (!products.length || bulkBusy) return;
    const queue = products.flatMap((product) => productOriginalImages(product)
      .filter((image) => !image.isHidden && image.viewType !== "OTHER" && selectedImageIds.includes(image.id))
      .map((image) => ({ product, image })));
    if (!queue.length) return setError("Jelölj ki legalább egy terméket az AI-generáláshoz.");
    const label = gender === "female" ? "Nő" : "Férfi";
    activeAiBatch.stopRequested = false;
    activeAiBatch.running = true;
    setBulkBusy(true);
    setError("");
    setMessage(`Generálás indul (${label}): 0/${queue.length}`);
    try {
      for (let index = 0; index < queue.length; index += 1) {
        if (activeAiBatch.stopRequested) {
          setMessage(`A generálás leállítva: ${index}/${queue.length} kép készült el.`);
          break;
        }
        const { product, image } = queue[index];
        setBusyId(product.id);
        setMessage(`Generálás folyamatban (${label}): ${index + 1}/${queue.length} (#${product.displayNumber})`);
        const controller = new AbortController();
        activeAiBatch.controller = controller;
        await generate(product, gender, image.id, controller.signal);
        activeAiBatch.controller = null;
      }
      if (!activeAiBatch.stopRequested) setMessage(`Elkészült (${label}): ${queue.length}/${queue.length} AI-generálás.`);
      await load();
    } catch (err) {
      if (activeAiBatch.stopRequested || (err instanceof DOMException && err.name === "AbortError")) {
        setMessage("A generálás leállítva. A már elkészült képek megmaradtak.");
      } else {
        setError(err instanceof Error ? err.message : "Generálási hiba");
      }
      await load();
    } finally {
      setBusyId(null);
      setBulkBusy(false);
      activeAiBatch.running = false;
      activeAiBatch.controller = null;
    }
  }

  function stopGeneration() {
    activeAiBatch.stopRequested = true;
    activeAiBatch.controller?.abort();
    setMessage("Leállítás kérése elküldve. A következő képek már nem indulnak el.");
  }

  async function remove(product: Product) {
    if (await deleteProduct(product)) await load();
  }

  async function generateSelectedImages(product: Product, gender: ModelGender) {
    const images = productOriginalImages(product).filter((image) => !image.isHidden && image.viewType !== "OTHER" && selectedImageIds.includes(image.id));
    if (!images.length) return setError("Jelölj ki legalább egy képet ezen a termékkártyán.");
    setBulkBusy(true);
    try {
      for (const image of images) await generate(product, gender, image.id);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>AI-generálás</h1>
      </header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      {products.length > 0 && (
        <section className="bulk-action-panel">
          <button className="tdo-primary icon-text" disabled={bulkBusy || busyId !== null} onClick={() => generateAll("female")}>
            <Sparkles size={22} /> {bulkBusy ? "Generálás folyamatban..." : "Generálás mind (Nő)"}
          </button>
          <button className="secondary icon-text" disabled={bulkBusy || busyId !== null} onClick={() => generateAll("male")}>
            <Sparkles size={22} /> Generálás mind (Férfi)
          </button>
          {bulkBusy && <button className="danger icon-text" onClick={stopGeneration}><Ban size={20} /> Generálás leállítása</button>}
          <span>{selectedImageIds.length} kép kijelölve</span>
        </section>
      )}
      <section className="share-grid ai-share-grid">
        {products.map((product) => <AiQueueCard product={product} selectedImageIds={selectedImageIds} busy={bulkBusy || busyId === product.id} onToggleImage={(imageId) => setSelectedImageIds((current) => current.includes(imageId) ? current.filter((id) => id !== imageId) : [...current, imageId])} onFemale={() => generateSelectedImages(product, "female")} onMale={() => generateSelectedImages(product, "male")} onDelete={() => remove(product)} key={product.id} />)}
      </section>
      {products.length === 0 && <EmptyState title="Nincs AI-generálásra váró kép" />}
    </>
  );
}

function AiQueueCard({ product, selectedImageIds, busy, onToggleImage, onFemale, onMale, onDelete }: { product: Product; selectedImageIds: number[]; busy: boolean; onToggleImage: (imageId: number) => void; onFemale: () => void; onMale: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const originals = productOriginalImages(product);
  const isMulti = originals.length > 1;
  return (
    <article className={`share-card ai-queue-card ${isMulti ? "multi-photo-card" : ""} ${open ? "share-card-open" : ""}`}>
      <button className="share-card-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div className={`share-image-stack ${isMulti ? "multiple" : ""}`}>{originals.map((image, index) => {
          const notGeneratable = image.viewType === "OTHER";
          return <div className={`ai-queue-image ${!selectedImageIds.includes(image.id) || image.isHidden || notGeneratable ? "image-excluded" : ""}`} key={image.id}>
            <img src={imageUrl(image)} alt={`AI-generálásra vár ${product.displayNumber}, ${index + 1}. kép`} onClick={(event) => { event.stopPropagation(); if (!notGeneratable) onToggleImage(image.id); }} />
            <span>{notGeneratable ? "Egyéb - nem generálható" : imageViewLabel(image.viewType)}</span>
          </div>;
        })}</div>
        <span className="share-card-caption"><strong>#{product.displayNumber}</strong><span>{product.productName || product.productId}</span></span>
      </button>
      {open && <div className="publish-panel">
        <h2>#{product.displayNumber}</h2>
        <p className="status-note">Koppints egy képre a kihagyásához; a beszürkült képek nem kerülnek AI-generálásra. Az Egyéb képek csak a galériában maradnak meg.</p>
        <dl><dt>Product ID</dt><dd>{product.productId}</dd><dt>Ár</dt><dd>{formatHuf(product.price)}</dd><dt>Méretek</dt><dd>{formatProductSizes(product)}</dd></dl>
        <div className="big-action-grid">
          <button className="primary icon-text" disabled={busy} onClick={onFemale}><Sparkles size={20} /> AI-generálás (Nő)</button>
          <button className="secondary icon-text" disabled={busy} onClick={onMale}><Sparkles size={20} /> AI-generálás (Férfi)</button>
          <button className="danger icon-text" disabled={busy} onClick={onDelete}><Trash2 size={20} /> Törlés</button>
        </div>
      </div>}
    </article>
  );
}

function ShareCenter() {
  const [products, setProducts] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<{ products: Product[] }>("/api/products");
    setProducts(res.products);
  }

  useEffect(() => {
    void load();
  }, []);

  async function publishToWebsite(product: Product) {
    setBusyId(product.id);
    await api(`/api/products/${product.id}/approve`, { method: "POST" });
    await load();
    setMessage(`#${product.displayNumber} megjelent a honlapon.`);
    setBusyId(null);
  }

  async function shareToFacebook(product: Product, variant: ShareVariant) {
    const image = variant === "raw" ? productOriginalImage(product) : productGeneratedImage(product);
    if (!image) return;
    const url = imageUrl(image);
    const text = productShareText(product);
    const title = variant === "raw" ? `Termék ${product.displayNumber}_nyers` : `Termék ${product.displayNumber}`;
    if (navigator.share) {
      const file = await imageFileForShare(product, image, variant);
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return;
      }
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\nKép: ${variant === "raw" ? shareFilename(product, variant, "image/jpeg") : `termek_${product.displayNumber}`}\n${url}`);
      alert("A posztszöveg és kép linkje a vágólapra került.");
    }
  }

  async function downloadShareImage(product: Product, variant: ShareVariant) {
    const image = variant === "generated" ? productGeneratedImage(product) : productOriginalImage(product);
    if (!image) return;
    setBusyId(product.id);
    try {
      await downloadProductImage(product, image, variant);
    } finally {
      setBusyId(null);
    }
  }

  async function sendToAi(product: Product) {
    setBusyId(product.id);
    try {
      await api(`/api/products/${product.id}/send-to-ai`, { method: "POST" });
      setMessage(`#${product.displayNumber} visszakerült az AI-generálási sorba.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function setDisplayImage(product: Product, image: ProductImage) {
    setBusyId(product.id);
    try {
      await api(`/api/products/${product.id}/display-image`, { method: "PUT", body: JSON.stringify({ image_id: image.id }) });
      setMessage(`#${product.displayNumber} megjelenő képe frissítve.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const multiPhoto = products.filter((product) => productOriginalImages(product).length > 1);
  const originalOnly = products.filter((product) => productOriginalImages(product).length === 1);
  const generated = products.filter((product) => productOriginalImages(product).length === 1 && productGeneratedImage(product));

  return (
    <>
      <header className="topbar"><h1>Megosztás</h1></header>
      {message && <p className="success">{message}</p>}
      <ShareSection
        title="Több fotós termékek"
        hint="Több eredeti fotóval feltöltött termékek. A vásárlói galéria is ezt a képsorrendet követi."
        products={multiPhoto}
        variant="multi"
        busyId={busyId}
        onDownload={downloadShareImage}
        onWebsite={publishToWebsite}
        onSendToAi={sendToAi}
        onSetDisplayImage={setDisplayImage}
        onDeleted={load}
      />
      <ShareSection
        title="Egyfotós termékek AI nélkül"
        hint="Eredeti, AI nélküli képek letöltéshez és honlapra publikáláshoz."
        products={originalOnly}
        variant="raw"
        busyId={busyId}
        onDownload={downloadShareImage}
        onWebsite={publishToWebsite}
        onSendToAi={sendToAi}
        onSetDisplayImage={setDisplayImage}
        onDeleted={load}
      />
      <ShareSection
        title="Egyfotós termékek AI-generált"
        hint="AI-val előkészített termékfotók letöltéshez és honlapra publikáláshoz."
        products={generated}
        variant="generated"
        busyId={busyId}
        onDownload={downloadShareImage}
        onWebsite={publishToWebsite}
        onSendToAi={sendToAi}
        onSetDisplayImage={setDisplayImage}
        onDeleted={load}
      />
    </>
  );
}

function ShareSection({ title, hint, products, variant, busyId, onDownload, onWebsite, onSendToAi, onSetDisplayImage, onDeleted }: {
  title: string;
  hint: string;
  products: Product[];
  variant: ShareVariant;
  busyId: number | null;
  onDownload: (product: Product, variant: ShareVariant) => Promise<void>;
  onWebsite: (product: Product) => Promise<void>;
  onSendToAi: (product: Product) => Promise<void>;
  onSetDisplayImage: (product: Product, image: ProductImage) => Promise<void>;
  onDeleted: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(25);
  const [open, setOpen] = useState(true);
  const visibleProducts = products.slice(0, visibleCount);
  const remaining = Math.max(0, products.length - visibleCount);

  useEffect(() => {
    setVisibleCount(25);
  }, [products.length, variant]);

  return (
    <section className={`share-section ${open ? "share-section-open" : "share-section-closed"}`}>
      <button className="section-heading share-section-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <span className="share-section-status">
          <strong>{products.length} tétel</strong>
          <span>{open ? "Becsukás" : "Kinyitás"}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="share-grid">
            {visibleProducts.map((product) => (
              <ShareCard
                product={product}
                variant={variant}
                busy={busyId === product.id}
                onDownload={() => onDownload(product, variant)}
                onWebsite={() => onWebsite(product)}
                onSendToAi={() => onSendToAi(product)}
                onSetDisplayImage={(image) => onSetDisplayImage(product, image)}
                onDeleted={onDeleted}
                key={product.id}
              />
            ))}
          </div>
          {remaining > 0 && (
            <button className="secondary load-more-button" onClick={() => setVisibleCount((count) => count + 25)}>
              További {Math.min(25, remaining)} megnyitása
            </button>
          )}
          {products.length === 0 && <EmptyState title="Ebben a csoportban most nincs megosztható kép" />}
        </>
      )}
    </section>
  );
}

function ShareCard({ product, variant, busy, onDownload, onWebsite, onSendToAi, onSetDisplayImage, onDeleted }: { product: Product; variant: ShareVariant; busy: boolean; onDownload: () => void; onWebsite: () => void; onSendToAi: () => void; onSetDisplayImage: (image: ProductImage) => void; onDeleted: () => void }) {
  const originals = productOriginalImages(product);
  const shareImages = productShareImages(product);
  const image = variant === "generated" ? productGeneratedImage(product) : productOriginalImage(product);
  const url = imageUrl(image);
  const waitingForAi = variant === "generated" && !image;
  const isMulti = variant === "multi";
  const generatedImage = productGeneratedImage(product);
  const previewImages = shareImages.slice(0, 2);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  async function remove() {
    if (await deleteProduct(product)) onDeleted();
  }

  return (
    <article className={`share-card ${isMulti ? "multi-photo-card" : ""} ${open ? "share-card-open" : ""}`}>
      <div className="share-card-trigger" onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((value) => !value); } }} aria-expanded={open} role="button" tabIndex={0}>
        {isMulti && !open ? <div className="share-image-stack multiple">
          <span className="share-image-count">{shareImages.length} db kép</span>
          {previewImages.map((shareImage, index) => <div className={`share-stack-image ${shareImage.isHidden ? "hidden-image" : ""}`} key={shareImage.id}>
          <img src={imageUrl(shareImage)} alt={`Megosztható termék ${product.displayNumber}, ${index + 1}. kép`} />
          <span className="share-image-type">{shareImage.imageType === "ORIGINAL" ? "Eredeti" : "AI"}</span>
        </div>)}</div> : !isMulti && <div className="share-image-slot">
        {image ? (
          <img src={url} alt={`Megosztható termék ${product.displayNumber}`} />
        ) : (
          <div className="share-ai-pending" aria-label="AI-generálásra vár">
            <span className="pending-ban"><Ban size={32} /></span>
            <strong>AI-generálásra vár</strong>
            <small>Az eredeti kép megmaradt, az AI-verzió még nem készült el.</small>
          </div>
        )}
        </div>}
        <span className="share-card-caption">
          <strong>#{product.displayNumber}</strong>
          <span>{product.productName || product.productId}</span>
        </span>
      </div>
      {open && <div className="publish-panel">
        {isMulti && <ImageVisibilityEditor product={product} onSaved={onDeleted} />}
        <h2>#{product.displayNumber}</h2>
        <span className="status-note">{isMulti ? `${originals.length} eredeti kép, ${shareImages.filter((shareImage) => shareImage.imageType !== "ORIGINAL").length} AI-kép` : variant === "raw" ? `Nyers kép: termek_${product.displayNumber}_nyers` : waitingForAi ? "AI-verzió még nincs kész" : "AI-generált kép"}</span>
        <dl>
          <dt>Product ID</dt><dd>{product.productId}</dd>
          <dt>Megnevezés</dt><dd>{product.productName || "-"}</dd>
          <dt>Ár</dt><dd>{formatHuf(product.price)}</dd>
          <dt>Méretek</dt><dd>{formatProductSizes(product)}</dd>
          <dt>Állapot</dt><dd>{product.status === "APPROVED" ? "Honlapon" : "Nincs honlapon"}</dd>
        </dl>
        <div className="big-action-grid">
          <button className="primary icon-text" disabled={busy || !image} onClick={onDownload}><Download size={20} /> Kép letöltése</button>
          <button className="secondary icon-text" disabled={busy || waitingForAi} onClick={onWebsite}><FolderCheck size={20} /> Honlapra</button>
          <button className="secondary icon-text" disabled={busy} onClick={onSendToAi}><Sparkles size={20} /> AI-generálásra küldés</button>
          {originals[0] && <button className="secondary icon-text" disabled={busy} onClick={() => onSetDisplayImage(originals[0])}><RefreshCcw size={20} /> Eredeti kép használata</button>}
          {generatedImage && <button className="secondary icon-text" disabled={busy} onClick={() => onSetDisplayImage(generatedImage)}><RefreshCcw size={20} /> AI-kép használata</button>}
          <button className="secondary icon-text" disabled={busy} onClick={() => setEditing((value) => !value)}><Eye size={20} /> Módosítás</button>
          <button className="danger icon-text" disabled={busy} onClick={remove}><Trash2 size={20} /> Törlés</button>
        </div>
        {editing && <ProductEditForm product={product} onSaved={() => { setEditing(false); onDeleted(); }} />}
      </div>}
    </article>
  );
}

function ProductEditForm({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const initialColorVariants = productColors(product).map((color) => {
    const sizes = sortedProductSizes(product, color);
    return {
      color,
      sizes: sizes.map((size) => size.size),
      quantities: Object.fromEntries(sizes.map((size) => [size.size, size.quantity == null ? "" : String(size.quantity)])) as Record<string, string>
    };
  });
  const [form, setForm] = useState({
    product_id: product.productId,
    product_name: product.productName ?? "",
    price: String(product.price),
    available_sizes: initialColorVariants.length ? [] : product.sizes.map((size) => size.size),
    size_quantities: initialColorVariants.length ? {} : Object.fromEntries(product.sizes.map((size) => [size.size, size.quantity == null ? "" : String(size.quantity)])) as Record<string, string>,
    color_variants: initialColorVariants,
    category: product.category ?? "",
    description: product.description ?? "",
    reservable_until: toLocalDateTimeInput(product.reservableUntil),
    no_expiry: !product.reservableUntil && !product.reservableDurationHours
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const validationError = productFormError(form);
    if (validationError) return setError(validationError);
    setBusy(true);
    setError("");
    try {
      await api(`/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          product_id: form.product_id,
          product_name: form.product_name || null,
          price: Number(form.price),
          available_sizes: form.color_variants.length ? [] : form.available_sizes,
          size_quantities: form.color_variants.length ? {} : sizeQuantityPayload(form.available_sizes, form.size_quantities),
          color_variants: form.color_variants.length ? colorVariantPayload(form.color_variants) : undefined,
          category: form.category || null,
          description: form.description || null,
          reservable_until: form.no_expiry || !form.reservable_until ? null : new Date(form.reservable_until).toISOString(),
          reservable_duration_hours: form.no_expiry || form.reservable_until ? null : product.reservableDurationHours ?? null
        })
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A módosítás sikertelen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="edit-panel form-grid product-data-form" onSubmit={save}>
      {error && <p className="error wide">{error}</p>}
      <Text label="Product ID" value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
      <Text label="Termék megnevezése" value={form.product_name} onChange={(product_name) => setForm({ ...form, product_name })} />
      <Text label="Ár (Ft)" type="number" value={form.price} onChange={(price) => setForm({ ...form, price })} />
      {form.color_variants.length ? (
        <ColorVariantFields variants={form.color_variants} onChange={(color_variants) => setForm({ ...form, color_variants })} />
      ) : (
        <>
          <SizePicker value={form.available_sizes} onChange={(available_sizes) => setForm({ ...form, available_sizes })} />
          <SizeQuantityFields
            sizes={form.available_sizes}
            quantities={form.size_quantities}
            onChange={(size, quantity) => setForm({ ...form, size_quantities: { ...form.size_quantities, [size]: quantity } })}
          />
          <button className="secondary icon-text color-mode-button" type="button" onClick={() => setForm({ ...form, available_sizes: [], size_quantities: {}, color_variants: [{ color: "", sizes: [], quantities: {} }] })}>
            <Plus size={18} /> Színenkénti méretek és készlet megadása
          </button>
        </>
      )}
      <CategoryPicker value={form.category} onChange={(category) => setForm({ ...form, category })} />
      <label className="checkbox-line wide">
        <input
          type="checkbox"
          checked={form.no_expiry}
          onChange={(event) => setForm({ ...form, no_expiry: event.target.checked, reservable_until: event.target.checked ? "" : form.reservable_until })}
        />
        Határidő nélkül foglalható
      </label>
      <Text label="Foglalható eddig" type="datetime-local" value={form.reservable_until} onChange={(reservable_until) => setForm({ ...form, reservable_until, no_expiry: false })} />
      <label className="wide">
        Leírás
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </label>
      <ImageVisibilityEditor product={product} onSaved={onSaved} />
      <button className="primary wide" disabled={busy} type="submit">Módosítás mentése</button>
    </form>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="panel empty-state">{title}</div>;
}

function ApprovedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  async function load() {
    api<{ products: Product[] }>("/api/products?status=APPROVED").then((res) => setProducts(res.products));
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <header className="topbar"><h1>Kész képek</h1></header>
      <section className="cards">
        {products.map((product) => <ProductCard product={product} onDeleted={load} key={product.id} />)}
      </section>
    </>
  );
}

function CurrentOfferings() {
  const [products, setProducts] = useState<Product[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");
  async function load() {
    const [productRes, reservationRes] = await Promise.all([
      api<{ products: Product[] }>("/api/products?status=APPROVED"),
      api<{ reservations: Reservation[] }>("/api/reservations")
    ]);
    setProducts(productRes.products.filter((product) => productDisplayImage(product)));
    setReservations(reservationRes.reservations);
  }
  useEffect(() => {
    void load();
  }, []);
  function reservationsForProduct(productId: number) {
    return reservations.filter((reservation) => reservation.productFk === productId);
  }
  async function downloadCurrentImage(product: Product) {
    const image = productDisplayImage(product);
    if (image) await downloadProductImage(product, image, productGeneratedImage(product) ? "generated" : "raw");
  }
  async function updateAllDeadlines(event: React.FormEvent) {
    event.preventDefault();
    setBulkMessage("");
    setBulkError("");
    if (!bulkDeadline) {
      setBulkError("Adj meg egy új foglalási határidőt.");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await api<{ count: number; products: Product[] }>("/api/products/bulk/reservation-deadline", {
        method: "PATCH",
        body: JSON.stringify({ reservable_until: new Date(bulkDeadline).toISOString() })
      });
      setProducts(res.products.filter((product) => productDisplayImage(product)));
      setBulkMessage(`${res.count} élő termék foglalási határideje frissült.`);
      setBulkDeadline("");
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "A tömeges határidő módosítása sikertelen.");
    } finally {
      setBulkBusy(false);
    }
  }
  return (
    <>
      <header className="topbar"><h1>Jelenlegi kínálat</h1></header>
      <section className="panel bulk-deadline-panel">
        <div>
          <h2>Foglalási határidő tömeges módosítása</h2>
          <p>Az itt megadott időpont felülírja az összes jelenleg élő termék korábbi foglalási határidejét.</p>
        </div>
        <form className="bulk-deadline-form" onSubmit={updateAllDeadlines}>
          <label>
            Új foglalási határidő
            <input type="datetime-local" value={bulkDeadline} onChange={(event) => setBulkDeadline(event.target.value)} />
          </label>
          <button className="primary" disabled={bulkBusy || products.length === 0} type="submit">
            {bulkBusy ? "Frissítés..." : "Összes élő termék frissítése"}
          </button>
        </form>
        {bulkError && <p className="error">{bulkError}</p>}
        {bulkMessage && <p className="success">{bulkMessage}</p>}
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kép</th>
                <th>#</th>
                <th>Megnevezés</th>
                <th>Ár</th>
                <th>Méretek</th>
                <th>Kategória</th>
                <th>Foglalható eddig</th>
                <th>Rendelt darab</th>
                <th>Rendelők</th>
                <th>Művelet</th>
              </tr>
            </thead>
            <tbody>
              {products.length ? products.map((product) => {
                const image = productDisplayImage(product);
                const productReservations = reservationsForProduct(product.id);
                const reservedCount = productReservations.reduce((sum, reservation) => sum + reservation.quantity, 0);
                return (
                  <Fragment key={product.id}>
                    <tr
                      className={`${productOriginalImages(product).length > 1 ? "multi-offering-row " : ""}offering-row-clickable`}
                      onClick={() => setEditingId(editingId === product.id ? null : product.id)}
                    >
                      <td><img className="table-thumb" src={imageUrl(image)} alt={`Termék ${product.displayNumber}`} /></td>
                      <td>#{product.displayNumber}</td>
                      <td>{product.productName || "-"}</td>
                      <td>{formatHuf(product.price)}</td>
                      <td>{formatProductSizes(product)}</td>
                      <td>{product.category || "-"}</td>
                      <td>{formatReservationDeadline(product.reservableUntil)}</td>
                      <td>{reservedCount} db</td>
                      <td>
                        {productReservations.length ? (
                          <div className="reservation-mini-list">
                            {productReservations.map((reservation) => (
                              <span key={reservation.id}>{reservation.user?.username ?? "-"}: {reservation.quantity} db ({reservation.color ? `${reservation.color}, ` : ""}{reservation.size})</span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="secondary table-action-btn" onClick={(event) => { event.stopPropagation(); void downloadCurrentImage(product); }}>Letöltés</button>
                          <button className="danger table-action-btn" onClick={async (event) => { event.stopPropagation(); if (await deleteProduct(product)) await load(); }}>Törlés</button>
                        </div>
                      </td>
                    </tr>
                    {editingId === product.id && (
                      <tr>
                        <td colSpan={10}>
                          <ProductEditForm product={product} onSaved={load} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              }) : (
                <tr><td colSpan={10} className="empty-table-cell">Még nincs honlapon megjelenő tétel.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DeletedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<{ products: Product[] }>("/api/products?status=ARCHIVED");
    setProducts(res.products);
  }

  useEffect(() => {
    void load();
  }, []);

  async function restore(product: Product) {
    const confirmed = window.confirm(`Visszaállítod ezt a tételt? #${product.displayNumber} (${product.productId})`);
    if (!confirmed) return;
    setBusyId(product.id);
    try {
      await api(`/api/products/${product.id}/restore`, { method: "POST" });
      setMessage(`#${product.displayNumber} visszaállítva.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="topbar"><h1>Törölt tételek</h1></header>
      {message && <p className="success">{message}</p>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kép</th>
                <th>#</th>
                <th>Product ID</th>
                <th>Megnevezés</th>
                <th>Ár</th>
                <th>Méretek</th>
                <th>Kategória</th>
                <th>Művelet</th>
              </tr>
            </thead>
            <tbody>
              {products.length ? products.map((product) => {
                const image = productDisplayImage(product);
                return (
                  <Fragment key={product.id}>
                    <tr>
                      <td>{image ? <img className="table-thumb" src={imageUrl(image)} alt={`Törölt termék ${product.displayNumber}`} /> : "-"}</td>
                      <td>#{product.displayNumber}</td>
                      <td>{product.productId}</td>
                      <td>{product.productName || "-"}</td>
                      <td>{formatHuf(product.price)}</td>
                      <td>{formatProductSizes(product)}</td>
                      <td>{product.category || "-"}</td>
                      <td><div className="table-actions">
                        <button className="secondary table-action-btn" onClick={() => setEditingId(editingId === product.id ? null : product.id)}>Képek</button>
                        <button className="primary table-action-btn" disabled={busyId === product.id} onClick={() => restore(product)}>Visszaállítás</button>
                      </div></td>
                    </tr>
                    {editingId === product.id && <tr><td colSpan={8}><ImageVisibilityEditor product={product} onSaved={async () => { setEditingId(null); await load(); }} /></td></tr>}
                  </Fragment>
                );
              }) : (
                <tr><td colSpan={8} className="empty-table-cell">Még nincs törölt tétel.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RegisteredUsers() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RegisteredUserForm | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<{ users: RegisteredUser[] }>("/api/auth/users");
    setUsers(res.users);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "A felhasználók betöltése sikertelen."));
  }, []);

  function startEdit(user: RegisteredUser) {
    setEditingId(user.id);
    setOpenActionsId(user.id);
    setEditForm({
      username: user.username,
      last_name: user.lastName ?? "",
      first_name: user.firstName ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      role: user.role === "ADMIN" ? "ADMIN" : "STAFF",
      is_active: user.isActive
    });
    setError("");
    setMessage("");
  }

  function updateEdit<K extends keyof RegisteredUserForm>(key: K, value: RegisteredUserForm[K]) {
    setEditForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function saveUser(user: RegisteredUser) {
    if (!editForm) return;
    setBusyId(user.id);
    setError("");
    setMessage("");
    try {
      await api(`/api/auth/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(editForm)
      });
      setEditingId(null);
      setOpenActionsId(null);
      setEditForm(null);
      setMessage("A felhasználó adatai frissültek.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A felhasználó mentése sikertelen.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(user: RegisteredUser) {
    const nextActive = !user.isActive;
    const confirmed = window.confirm(nextActive ? "Aktiválod ezt a felhasználót?" : "Inaktiválod ezt a felhasználót? A korábbi foglalásai megmaradnak, de nem fog tudni belépni.");
    if (!confirmed) return;
    setBusyId(user.id);
    setError("");
    setMessage("");
    try {
      await api(`/api/auth/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          username: user.username,
          email: user.email ?? "",
          last_name: user.lastName ?? "",
          first_name: user.firstName ?? "",
          phone: user.phone ?? "",
          role: user.role === "ADMIN" ? "ADMIN" : "STAFF",
          is_active: nextActive
        })
      });
      setMessage(nextActive ? "A felhasználó aktiválva." : "A felhasználó inaktiválva.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A felhasználó állapotának módosítása sikertelen.");
    } finally {
      setBusyId(null);
    }
  }

  async function anonymizeUser(user: RegisteredUser) {
    const confirmed = window.confirm("Biztosan törlöd/anonimizálod a személyes adatokat? A rendelési statisztika megmarad, de a név, telefon és e-mail törlődik.");
    if (!confirmed) return;
    setBusyId(user.id);
    setError("");
    setMessage("");
    try {
      await api(`/api/auth/users/${user.id}/anonymize`, { method: "POST" });
      setMessage("A felhasználó személyes adatai anonimizálva lettek.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Az anonimizálás sikertelen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>Regisztrált felhasználók</h1>
      </header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sorszám</th>
                <th>Felhasználónév</th>
                <th>Vezetéknév</th>
                <th>Keresztnév</th>
                <th>Telefonszám</th>
                <th>E-mail</th>
                <th>Jogosultság</th>
                <th>Állapot</th>
                <th>Adatkezelés elfogadva</th>
                <th>Regisztráció</th>
                <th>Művelet</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((registeredUser, index) => {
                const isEditing = editingId === registeredUser.id && editForm;
                const isOpen = openActionsId === registeredUser.id;
                return (
                  <tr key={registeredUser.id} className={isOpen ? "user-row-open" : ""}>
                    <td><strong>{users.length - index}.</strong></td>
                    <td>{isEditing ? <input value={editForm.username} onChange={(e) => updateEdit("username", e.target.value)} /> : registeredUser.username}</td>
                    <td>{isEditing ? <input value={editForm.last_name} onChange={(e) => updateEdit("last_name", e.target.value)} /> : registeredUser.lastName || "-"}</td>
                    <td>{isEditing ? <input value={editForm.first_name} onChange={(e) => updateEdit("first_name", e.target.value)} /> : registeredUser.firstName || "-"}</td>
                    <td>{isEditing ? <input value={editForm.phone} onChange={(e) => updateEdit("phone", e.target.value)} /> : registeredUser.phone || "-"}</td>
                    <td>{isEditing ? <input value={editForm.email} onChange={(e) => updateEdit("email", e.target.value)} type="email" /> : registeredUser.email || "-"}</td>
                    <td>
                      {isEditing ? (
                        <select value={editForm.role} onChange={(e) => updateEdit("role", e.target.value as RegisteredUserForm["role"])}>
                          <option value="STAFF">Felhasználó</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : registeredUser.role === "ADMIN" ? "Admin" : "Felhasználó"}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="table-checkbox" aria-label="Felhasználó aktív">
                          <input type="checkbox" checked={editForm.is_active} onChange={(e) => updateEdit("is_active", e.target.checked)} />
                        </label>
                      ) : registeredUser.isActive ? "Aktív" : "Inaktív"}
                    </td>
                    <td>{registeredUser.privacyAcceptedAt ? formatDateTime(registeredUser.privacyAcceptedAt) : "-"}</td>
                    <td>{formatDateTime(registeredUser.createdAt)}</td>
                    <td>
                      <div className="user-action-menu">
                        <button
                          className="secondary table-action-btn"
                          disabled={busyId === registeredUser.id}
                          onClick={() => setOpenActionsId((current) => current === registeredUser.id ? null : registeredUser.id)}
                        >
                          {isOpen ? "Műveletek bezárása" : "Műveletek"}
                        </button>
                        {isOpen && <div className="table-actions user-actions-expanded">
                        {isEditing ? (
                          <>
                            <button className="primary table-action-btn" disabled={busyId === registeredUser.id} onClick={() => saveUser(registeredUser)}>Mentés</button>
                            <button className="secondary table-action-btn" disabled={busyId === registeredUser.id} onClick={() => { setEditingId(null); setOpenActionsId(null); setEditForm(null); }}>Mégse</button>
                          </>
                        ) : (
                          <>
                            <button className="secondary table-action-btn" disabled={busyId === registeredUser.id} onClick={() => startEdit(registeredUser)}>Módosítás</button>
                            <button className="secondary table-action-btn" disabled={busyId === registeredUser.id} onClick={() => toggleActive(registeredUser)}>
                              {registeredUser.isActive ? "Inaktiválás" : "Aktiválás"}
                            </button>
                            <button className="danger table-action-btn" disabled={busyId === registeredUser.id} onClick={() => anonymizeUser(registeredUser)}>Személyes adatok törlése</button>
                          </>
                        )}
                        </div>}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={11} className="empty-table-cell">Még nincs regisztrált felhasználó.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Orders() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [purchasedProcurementKeys, setPurchasedProcurementKeys] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<{ reservations: Reservation[] }>("/api/reservations");
    setReservations(res.reservations);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "A rendelések betöltése sikertelen."));
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(PURCHASED_PROCUREMENT_ITEMS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setPurchasedProcurementKeys(parsed.filter((item) => typeof item === "string"));
    } catch {
      setPurchasedProcurementKeys([]);
    }
  }, []);

  async function updateReservationStatus(reservation: Reservation, status: ReservationStatus) {
    setBusyId(reservation.id);
    setError("");
    setMessage("");
    try {
      await api(`/api/reservations/${reservation.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setMessage("Rendelési státusz frissítve.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A státusz módosítása sikertelen.");
    } finally {
      setBusyId(null);
    }
  }

  function procurementKey(product: Product, size: string, color?: string | null) {
    return `${product.id}:${color ?? "-"}:${size}`;
  }

  function togglePurchasedProcurementItem(key: string) {
    setPurchasedProcurementKeys((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      window.localStorage.setItem(PURCHASED_PROCUREMENT_ITEMS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function dateStart(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }

  function dateEnd(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  }

  function sortReservationsForOrders(source: Reservation[]) {
    return [...source].sort((a, b) => {
      const displayDiff = Number(a.product.displayNumber) - Number(b.product.displayNumber);
      if (Number.isFinite(displayDiff) && displayDiff !== 0) return displayDiff;
      return new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime();
    });
  }

  function filteredReservations() {
    if (exportFrom && exportTo && dateStart(exportFrom) > dateEnd(exportTo)) {
      return [];
    }
    return reservations.filter((reservation) => {
      const reservedAt = new Date(reservation.reservedAt).getTime();
      if (exportFrom && reservedAt < dateStart(exportFrom)) return false;
      if (exportTo && reservedAt > dateEnd(exportTo)) return false;
      return true;
    });
  }

  function procurementGroupsFor(source: Reservation[]) {
    return Array.from(source.reduce((groups, reservation) => {
      const key = procurementKey(reservation.product, reservation.size, reservation.color);
      const group = groups.get(key) ?? { product: reservation.product, color: reservation.color ?? null, size: reservation.size, quantity: 0, reservations: [] as Reservation[] };
      group.quantity += reservation.quantity;
      group.reservations.push(reservation);
      groups.set(key, group);
      return groups;
    }, new Map<string, { product: Product; color: string | null; size: string; quantity: number; reservations: Reservation[] }>()).values());
  }

  function reservationsByUserFor(source: Reservation[]) {
    return Array.from(source.reduce((groups, reservation) => {
      const username = reservation.user?.username ?? "-";
      const group = groups.get(username) ?? { username, quantity: 0, amount: 0, reservations: [] as Reservation[] };
      group.quantity += reservation.quantity;
      group.amount += reservation.product.price * reservation.quantity;
      group.reservations.push(reservation);
      groups.set(username, group);
      return groups;
    }, new Map<string, { username: string; quantity: number; amount: number; reservations: Reservation[] }>()).values())
      .sort((a, b) => a.username.localeCompare(b.username, "hu"));
  }

  function exportOrdersXls() {
    if (exportFrom && exportTo && dateStart(exportFrom) > dateEnd(exportTo)) {
      setError("Az export kezdő dátuma nem lehet későbbi, mint a záró dátum.");
      return;
    }
    setError("");
    const exportReservations = sortReservationsForOrders(filteredReservations());
    const exportProcurementGroups = procurementGroupsFor(exportReservations);
    const exportReservationsByUser = reservationsByUserFor(exportReservations);
    const dateLabel = exportFrom || exportTo ? `-${exportFrom || "kezdet"}-${exportTo || "vege"}` : "";
    const rows: Array<Array<string | number | null | undefined>> = [
      ["Összesen vásárlandó"],
      ["Product ID", "Sorszám", "Termék", "Méret", "Összesen vásárlandó", "Foglalók", "Megvéve"],
      ...exportProcurementGroups.map((group) => [
        group.product.productId,
        `#${group.product.displayNumber}`,
        productTitle(group.product),
        group.color ? `${group.color}, ${group.size}` : group.size,
        `${group.quantity} db`,
        [`Összesen: ${group.quantity} db`, ...group.reservations.map((reservation) => `${reservation.quantity} db - ${reservation.user?.username ?? "-"}`)].join(" | "),
        purchasedProcurementKeys.includes(procurementKey(group.product, group.size, group.color)) ? "Igen" : ""
      ]),
      [],
      ["Rendelések termék szerint"],
      ["Product ID", "Sorszám", "Termék", "Méret", "Lefoglalt darabszám", "Foglaló felhasználó és foglalás ideje", "Státusz"],
      ...exportProcurementGroups.map((group) => [
        group.product.productId,
        `#${group.product.displayNumber}`,
        productTitle(group.product),
        group.color ? `${group.color}, ${group.size}` : group.size,
        `${group.quantity} db`,
        group.reservations.map((reservation) => `${reservation.user?.username ?? "-"} - ${formatDateTime(reservation.reservedAt)}`).join(" | "),
        group.reservations.map((reservation) => reservationStatusLabels[reservation.status]).join(" | ")
      ]),
      [],
      ["Rendelések felhasználók szerint"],
      ["Felhasználó", "Rendelések", "Összes darab", "Fizetendő", "Státusz"],
      ...exportReservationsByUser.map((group) => [
        group.username,
        group.reservations.map((reservation) => `${productNumberPair(reservation.product)} / ${productTitle(reservation.product)} / ${reservation.color ? `${reservation.color}, ` : ""}${reservation.size} / ${reservation.quantity} db`).join(" | "),
        `${group.quantity} db`,
        group.amount,
        group.reservations.map((reservation) => customerFulfillmentStatusLabels[reservation.status]).join(" | ")
      ])
    ];
    downloadCsv(`tunde-divat-rendelok-rendelesek${dateLabel}-${new Date().toISOString().slice(0, 10)}.csv`, [
      ...rows
    ]);
  }

  const visibleReservations = filteredReservations();
  const sortedReservations = sortReservationsForOrders(visibleReservations);
  const procurementGroups = procurementGroupsFor(sortedReservations);
  const reservationsByUser = reservationsByUserFor(sortedReservations);
  const filteredCount = visibleReservations.length;
  const isDateRangeInvalid = !!exportFrom && !!exportTo && dateStart(exportFrom) > dateEnd(exportTo);

  return (
    <>
      <header className="topbar">
        <h1>Rendelők és rendelések</h1>
        <button className="secondary icon-text" onClick={exportOrdersXls}><Download size={18} /> Táblázat mentése</button>
      </header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <section className="panel export-filter-panel">
        <div>
          <h2>Dátumszűrő</h2>
          <p>A felület és a letöltés is csak a megadott foglalási dátumtartomány rendeléseit mutatja.</p>
        </div>
        <label>
          Kezdő dátum
          <input type="date" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} />
        </label>
        <label>
          Záró dátum
          <input type="date" value={exportTo} onChange={(event) => setExportTo(event.target.value)} />
        </label>
        <div className="export-filter-actions">
          <strong>{isDateRangeInvalid ? "Hibás dátumtartomány" : `${filteredCount} foglalás látható`}</strong>
          <button className="secondary" onClick={() => { setExportFrom(""); setExportTo(""); }}>Szűrő törlése</button>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Összesen vásárlandó</h2>
          <span>{procurementGroups.length} termék-méret sor</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Sorszám</th>
                <th>Kép</th>
                <th>Termék</th>
                <th>Méret</th>
                <th>Összesen vásárlandó</th>
                <th>Foglalók</th>
                <th>Megvéve</th>
              </tr>
            </thead>
            <tbody>
              {procurementGroups.length ? procurementGroups.map((group) => {
                const key = procurementKey(group.product, group.size, group.color);
                const image = productDisplayImage(group.product);
                return (
                  <tr key={key}>
                    <td>{group.product.productId}</td>
                    <td>#{group.product.displayNumber}</td>
                    <td>{image ? <img className="table-thumb" src={imageUrl(image)} alt={`Vásárlandó termék ${group.product.displayNumber}`} /> : "-"}</td>
                    <td>{productTitle(group.product)}</td>
                    <td>{group.color ? `${group.color}, ${group.size}` : group.size}</td>
                    <td><strong>{group.quantity} db</strong></td>
                    <td>
                      <div className="order-lines">
                        <strong>Összesen: {group.quantity} db</strong>
                        {group.reservations.map((reservation) => (
                          <span key={reservation.id}>{reservation.quantity} db - {reservation.user?.username ?? "-"}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <label className="table-checkbox" aria-label={`${productNumberPair(group.product)} ${group.color ? `${group.color}, ` : ""}${group.size} megvéve`}>
                        <input type="checkbox" checked={purchasedProcurementKeys.includes(key)} onChange={() => togglePurchasedProcurementItem(key)} />
                      </label>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8} className="empty-table-cell">Még nincs vásárlandó termék.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Rendelések termék szerint</h2>
          <span>{sortedReservations.length} aktív foglalás</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Sorszám</th>
                <th>Kép</th>
                <th>Méret</th>
                <th>Lefoglalt darabszám</th>
                <th>Foglaló felhasználó, foglalás ideje</th>
                <th>Státusz</th>
              </tr>
            </thead>
            <tbody>
              {procurementGroups.length ? procurementGroups.map((group) => {
                const image = productDisplayImage(group.product);
                return (
                  <tr key={`${group.product.id}-${group.size}`}>
                    <td>{group.product.productId}</td>
                    <td>#{group.product.displayNumber}</td>
                    <td>{image ? <img className="table-thumb" src={imageUrl(image)} alt={`Rendelt termék ${group.product.displayNumber}`} /> : "-"}</td>
                    <td>{group.color ? `${group.color}, ${group.size}` : group.size}</td>
                    <td><strong>{group.quantity} db</strong></td>
                    <td>
                      <div className="order-lines">
                        {group.reservations.map((reservation) => (
                          <span key={reservation.id}>{reservation.user?.username ?? "-"} | {formatDateTime(reservation.reservedAt)}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="order-status-lines">
                        {group.reservations.map((reservation) => (
                          <select
                            className="status-select"
                            value={procurementStatuses.includes(reservation.status) ? reservation.status : "IN_STOCK_WAITING_PICKUP"}
                            disabled={busyId === reservation.id}
                            onChange={(event) => updateReservationStatus(reservation, event.target.value as ReservationStatus)}
                            key={reservation.id}
                          >
                            {procurementStatuses.map((status) => (
                              <option value={status} key={status}>{reservationStatusLabels[status]}</option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="empty-table-cell">Még nincs aktív rendelés.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Rendelések felhasználók szerint</h2>
          <span>{reservationsByUser.length} rendelő</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Felhasználó</th>
                <th>Rendelések</th>
                <th>Összes darab</th>
                <th>Fizetendő</th>
                <th>Státusz</th>
              </tr>
            </thead>
            <tbody>
              {reservationsByUser.length ? reservationsByUser.map((group) => (
                <tr key={group.username}>
                  <td>{group.username}</td>
                  <td>
                    <div className="order-lines">
                      {group.reservations.map((reservation) => (
                        <span key={reservation.id}>{productNumberPair(reservation.product)} | {productTitle(reservation.product)} | {reservation.color ? `${reservation.color}, ` : ""}{reservation.size} | {reservation.quantity} db</span>
                      ))}
                    </div>
                  </td>
                  <td><strong>{group.quantity} db</strong></td>
                  <td>{formatHuf(group.amount)}</td>
                  <td>
                    <div className="order-status-lines">
                      {group.reservations.map((reservation) => {
                        const value: ReservationStatus = reservation.status === "PICKED_UP_PAID" ? "PICKED_UP_PAID" : "IN_STOCK_WAITING_PICKUP";
                        return (
                          <select
                            className="status-select"
                            value={value}
                            disabled={busyId === reservation.id}
                            onChange={(event) => updateReservationStatus(reservation, event.target.value as ReservationStatus)}
                            key={reservation.id}
                          >
                            {customerFulfillmentStatuses.map((status) => (
                              <option value={status} key={status}>{customerFulfillmentStatusLabels[status]}</option>
                            ))}
                          </select>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="empty-table-cell">Még nincs aktív rendelés.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PickupSettings() {
  const [pickups, setPickups] = useState<PickupOption[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [form, setForm] = useState({ address: "", start_at: "", end_at: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [pickupRes, reservationRes] = await Promise.all([
      api<{ options: PickupOption[] }>("/api/pickups"),
      api<{ reservations: Reservation[] }>("/api/reservations")
    ]);
    setPickups(pickupRes.options);
    setReservations(reservationRes.reservations);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Az átvételi adatok betöltése sikertelen."));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/pickups", {
        method: "POST",
        body: JSON.stringify({
          address: form.address,
          start_at: localDateAt(form.start_at, 9),
          end_at: localDateAt(form.end_at || form.start_at, 17)
        })
      });
      setForm({ address: "", start_at: "", end_at: "" });
      setMessage("Az átvételi idősáv mentve.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentési hiba.");
    }
  }

  async function archivePickup(id: number) {
    if (!window.confirm("Biztosan törlöd ezt az átvételi idősávot? A korábbi foglalások előzményei megmaradnak.")) return;
    await api(`/api/pickups/${id}`, { method: "DELETE" });
    await load();
  }

  function exportReservationsXls() {
    const sorted = [...reservations].sort((a, b) => {
      const aTime = a.pickup ? new Date(a.pickup.startAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.pickup ? new Date(b.pickup.startAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
    downloadCsv(`tunde-divat-atvetelek-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Nap", "Felhasználó", "Sorszám", "Termék", "Méret", "Darab", "Ár Ft", "Átvétel helye", "Átvétel ideje", "Foglalás ideje"],
      ...sorted.map((reservation) => [
        formatPickupDay(reservation.pickup?.startAt),
        reservation.user?.username ?? "-",
        `#${reservation.product.displayNumber}`,
        productTitle(reservation.product),
        reservation.color ? `${reservation.color}, ${reservation.size}` : reservation.size,
        reservation.quantity,
        reservation.product.price,
        pickupAddress(reservation.pickup),
        pickupRangeText(reservation.pickup),
        formatDateTime(reservation.reservedAt)
      ])
    ]);
  }

  const reservationsByDay = Array.from(reservations.reduce((groups, reservation) => {
    const key = pickupDayKey(reservation.pickup?.startAt);
    const current = groups.get(key) ?? [];
    current.push(reservation);
    groups.set(key, current);
    return groups;
  }, new Map<string, Reservation[]>()).entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayReservations]) => ({
      day,
      label: groupDayLabel(day, dayReservations[0]?.pickup?.startAt),
      reservations: dayReservations.sort((a, b) => {
        const aTime = a.pickup ? new Date(a.pickup.startAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.pickup ? new Date(b.pickup.startAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
    }));

  return (
    <>
      <header className="topbar"><h1>6. Személyes átvétel megadása</h1></header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <section className="panel form-grid">
        <form className="form-grid wide" onSubmit={submit}>
          <Text label="Átvétel helye" value={form.address} onChange={(address) => setForm({ ...form, address })} />
          <Text label="Átvétel kezdő napja" type="date" value={form.start_at} onChange={(start_at) => setForm({ ...form, start_at, end_at: form.end_at || start_at })} />
          <Text label="Átvétel záró napja" type="date" value={form.end_at} onChange={(end_at) => setForm({ ...form, end_at })} />
          <button className="primary wide" type="submit">Átvételi idősáv mentése</button>
        </form>
      </section>
      <section className="panel reservations-panel">
        <div className="store-toolbar compact-toolbar">
          <div>
            <h2>Aktív átvételi idősávok</h2>
            <span>{pickups.length} időpont</span>
          </div>
        </div>
        <div className="pickup-options">
          {pickups.map((pickup) => (
            <div className="pickup-option" key={pickup.id}>
              <div>
                <strong>{pickup.address}</strong>
                <span>{formatPickupRange(pickup)}</span>
              </div>
              <button className="danger" onClick={() => archivePickup(pickup.id)}>Törlés</button>
            </div>
          ))}
          {!pickups.length && <div className="empty-state">Még nincs megadva átvételi időpont.</div>}
        </div>
      </section>
      <section className="panel reservations-panel">
        <div className="store-toolbar compact-toolbar">
          <div>
            <h2>Foglalások és érkezések</h2>
            <span>{reservations.length} aktív foglalás</span>
          </div>
          <button className="secondary icon-text" onClick={exportReservationsXls}><Download size={18} /> Táblázat mentése</button>
        </div>
        <div className="pickup-day-groups">
          {reservationsByDay.length ? reservationsByDay.map((group) => (
            <section className="pickup-day-box" key={group.day}>
              <h3>{group.label}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Felhasználó</th>
                      <th>Termék</th>
                      <th>Méret</th>
                      <th>Darab</th>
                      <th>Ár</th>
                      <th>Átvétel helye</th>
                      <th>Átvétel ideje</th>
                      <th>Foglalás ideje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td>{reservation.user?.username ?? "-"}</td>
                        <td>{productTitle(reservation.product)}</td>
                        <td>{reservation.color ? `${reservation.color}, ${reservation.size}` : reservation.size}</td>
                        <td>{reservation.quantity} db</td>
                        <td>{formatHuf(reservation.product.price)}</td>
                        <td>{pickupAddress(reservation.pickup)}</td>
                        <td>{pickupRangeText(reservation.pickup)}</td>
                        <td>{formatDateTime(reservation.reservedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )) : (
            <div className="empty-state">Még nincs aktív foglalás.</div>
          )}
        </div>
      </section>
    </>
  );
}

function ProductCard({ product, onDeleted }: { product: Product; onDeleted: () => void }) {
  const final = useMemo(() => [...product.images].reverse().find((img) => img.imageType === "FINAL"), [product]);
  const url = imageUrl(final);
  async function share() {
    const text = `#${product.displayNumber} - ${formatHuf(product.price)}\nMéretek: ${formatProductSizes(product)}`;
    if (navigator.share) {
      await navigator.share({ title: `Termék ${product.displayNumber}`, text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert("A posztszöveg és kép linkje a vágólapra került.");
    }
  }
  async function remove() {
    if (await deleteProduct(product)) onDeleted();
  }
  return (
    <article className="card">
      <img src={url} alt={`Termék ${product.displayNumber}`} />
      <div>
        <strong>#{product.displayNumber}</strong>
        <span>{product.productId}</span>
      </div>
      <p>{formatHuf(product.price)} · {formatProductSizes(product)}</p>
      <time>{new Date(product.createdAt).toLocaleDateString("hu-HU")}</time>
      <div className="button-row">
        <a className="button icon-text" href={url} target="_blank"><FolderCheck size={18} /> Megtekintés</a>
        <a className="button secondary icon-text" href={url} download><Download size={18} /> Letöltés</a>
        <button className="secondary icon-text" onClick={share}><Share2 size={18} /> Megosztás</button>
        <button className="danger icon-text" onClick={remove}><Trash2 size={18} /> Törlés</button>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
