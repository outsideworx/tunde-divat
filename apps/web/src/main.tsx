import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Ban, Camera, Download, Eye, FolderCheck, Heart, KeyRound, LogOut, Menu, PanelLeftClose, Plus, RefreshCcw, Search, Share2, ShoppingBag, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { allowedSizes, formatHuf, reservationStatuses, type ReservationStatus } from "@fashion-mvp/shared";
import "./styles.css";
import { useEffect, useMemo, useState } from "react";

const API =
  import.meta.env.VITE_API_URL ??
  `${window.location.protocol}//${window.location.hostname}:4000`;

type ProductImage = { id: number; imageType: "ORIGINAL" | "AI_GENERATED" | "FINAL"; width?: number; height?: number };
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
  sizes: { size: string; quantity?: number }[];
  images: ProductImage[];
  createdAt: string;
};
type PickupOption = { id: number; address: string; startAt: string; endAt: string; isActive: boolean };
type Reservation = {
  id: number;
  productFk: number;
  userId: number;
  pickupFk: number;
  size: string;
  quantity: number;
  status: ReservationStatus;
  canCancel: boolean;
  reservedAt: string;
  cancelledAt?: string | null;
  product: Product;
  pickup: PickupOption;
  user?: { id: number; username: string; email?: string | null };
};

type User = { id: number; username: string; email?: string | null; role: string };
type RegisteredUser = User & { lastName?: string | null; firstName?: string | null; phone?: string | null; createdAt: string };
type Step = "photo" | "data" | "saved";
type View = "dashboard" | "storefront" | "new" | "ai" | "share" | "current" | "orders" | "pickup" | "deleted";
type AdminView = View | "users";
type AuthMode = "login" | "register";
type StoreView = "catalog" | "reservations" | "favorites";
type ShareVariant = "raw" | "generated";
type ModelGender = "female" | "male";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const REMEMBER_LOGIN_KEY = "tdo:remember-login";
const REMEMBERED_USERNAME_KEY = "tdo:remembered-username";

const reservationStatusLabels: Record<ReservationStatus, string> = {
  PROCUREMENT_PENDING: "Beszerzésre vár",
  ACQUIRED: "Beszerezve",
  IN_STOCK_WAITING_PICKUP: "Raktárkészleten, átvételre vár",
  PICKED_UP_PAID: "Átvéve, kifizetve"
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
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

function imageUrl(image?: ProductImage) {
  return image ? `${API}/api/images/${image.id}` : "";
}

function productDisplayImage(product: Product) {
  return [...product.images].reverse().find((img) => img.imageType === "FINAL") ?? product.images.find((img) => img.imageType === "ORIGINAL");
}

function productOriginalImage(product: Product) {
  return product.images.find((img) => img.imageType === "ORIGINAL");
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
  return `${productTitle(product)} - ${formatHuf(product.price)}\nMéretek: ${product.sizes.map((s) => s.size).join("; ")}${product.description ? `\n${product.description}` : ""}`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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

function formatReservationDeadline(value?: string | null) {
  return value ? formatDateTime(value) : "Lejárat nélkül";
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

function productTitle(product: Product) {
  const name = product.productName || product.category || product.description?.split(/[.\n]/)[0].trim().slice(0, 48) || "Termék";
  return `#${product.displayNumber} ${name}`;
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

function isDeadlineUrgent(value?: string | null) {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff > 0 && diff <= 4 * 60 * 60 * 1000;
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

  if (loading) return <div className="boot">Betöltés...</div>;
  if (!user) return <Login onLogin={setUser} />;
  if (user.role !== "ADMIN") return <CustomerStorefront user={user} onLogout={() => setUser(null)} />;
  return <Shell user={user} onLogout={() => setUser(null)} />;
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
    invite_code: ""
  });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
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

  function setRegister<K extends keyof typeof registerForm>(key: K, value: string) {
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
      <span className="build-version">ver.: alpha 0.1</span>
      <section className="brand-panel">
        <div />
        <div>
          <img className="auth-logo" src="/assets/tunde-divat-online-logo.jpeg" alt="Tünde Divat Online" />
        </div>
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
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
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
    const haystack = [product.displayNumber, product.productId, product.productName, product.category, product.description, product.sizes.map((s) => s.size).join(" ")]
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
          <button className="logo-home-btn" onClick={() => goToStoreView("catalog")}><img className="header-logo" src="/assets/tunde-divat-online-logo.jpeg" alt="Tünde Divat Online" /></button>
          <div className="store-user">
            <span>{user.username} | felhasználó</span>
            <strong>{storeView === "reservations" ? "Foglalásaim" : storeView === "favorites" ? "Kedvencek" : "Aktuális kínálat"}</strong>
            <div className="header-reservation-summary">
              <span>Lefoglalt termékek száma: <strong>{reservationTotals.count} db</strong></span>
              <span>Fizetendő: <strong>{formatHuf(reservationTotals.amount)}</strong></span>
            </div>
          </div>
        </div>
        <nav className="store-nav">
          <button className={storeView === "catalog" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("catalog")}>Kínálat</button>
          <button className={storeView === "reservations" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("reservations")}>Foglalásaim</button>
          <button className={storeView === "favorites" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("favorites")}>Kedvencek</button>
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
              setMessage("A foglalás sikeres. Az admin felületen látszani fog, melyik átvételi időpontot választottad.");
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
            onBackToCatalog={() => setStoreView("catalog")}
            onCancel={async (reservation) => {
              const confirmed = window.confirm("Biztosan lemondod ezt a foglalást? Ha ugyanezt a terméket később újra lefoglalod, az új foglalást már nem fogod tudni lemondani.");
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
                <h2>Kedvencek</h2>
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
            {!favoriteProducts.length && <div className="panel empty-state">Még nincs kedvenc terméked.</div>}
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
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keresés sorszám, név, leírás alapján" />
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
          <span>Kínálat</span>
        </button>
        <button className={storeView === "favorites" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("favorites")}>
          <Heart size={20} fill={storeView === "favorites" && !detailProductId ? "currentColor" : "none"} />
          <span>Kedvencek</span>
        </button>
        <button className={storeView === "reservations" && !detailProductId ? "active" : ""} onClick={() => goToStoreView("reservations")}>
          <FolderCheck size={20} />
          <span>Foglalásaim</span>
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

function ReservationsPage({ reservations, onBackToCatalog, onCancel }: { reservations: Reservation[]; onBackToCatalog: () => void; onCancel: (reservation: Reservation) => Promise<void> }) {
  const totals = reservations.reduce((result, reservation) => {
    result.count += reservation.quantity;
    result.amount += reservation.quantity * reservation.product.price;
    return result;
  }, { count: 0, amount: 0 });
  return (
    <section className="panel reservations-panel">
      <div className="store-toolbar compact-toolbar">
        <div>
          <h2>Foglalásaim</h2>
          <span>{totals.count} db | {formatHuf(totals.amount)}</span>
        </div>
        <button className="secondary" onClick={onBackToCatalog}>Vissza a kínálathoz</button>
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
              <th>Termék</th>
              <th>Méret</th>
              <th>Darabszám</th>
              <th>Fizetendő</th>
              <th>Átvétel helye</th>
              <th>Átvétel ideje</th>
              <th>Művelet</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length ? reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>#{reservation.product.displayNumber}</td>
                <td>{reservation.size}</td>
                <td>{reservation.quantity}</td>
                <td>{formatHuf(reservation.product.price * reservation.quantity)}</td>
                <td>{reservation.pickup.address}</td>
                <td>{formatPickupRange(reservation.pickup)}</td>
                <td>
                  <button className="ghost table-action-btn" disabled={!reservation.canCancel} onClick={() => onCancel(reservation)}>
                    {reservation.canCancel ? "Foglalás lemondása" : "Nem lemondható"}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="empty-table-cell">Még nincs foglalásod.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StoreProductCard({ product, isFavorite, onToggleFavorite, onOpenDetail, tick }: { product: Product; isFavorite: boolean; onToggleFavorite: () => void; onOpenDetail: () => void; tick: number }) {
  const displayImage = productDisplayImage(product);
  return (
    <article className="store-card">
      <div className="store-image-wrap">
        <button className="store-image-button" onClick={onOpenDetail}>
          <img src={imageUrl(displayImage)} alt={`#${product.displayNumber}`} />
        </button>
        <button className={`favorite-button ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite} aria-label={isFavorite ? "Eltávolítás a kedvencekből" : "Kedvencekhez adás"}>
          <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="store-card-summary" onClick={onOpenDetail}>
        <span>{productTitle(product)}</span>
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
  const displayImage = productDisplayImage(product);
  const [size, setSize] = useState(product.sizes[0]?.size ?? "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const activeReservation = reservations[0];
  const deadlineExpired = product.reservableUntil ? Date.now() > new Date(product.reservableUntil).getTime() : false;

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function reserve() {
    setError("");
    if (!size) return setError("Válassz méretet a foglaláshoz.");
    const selectedPickup = earliestPickup ?? pickups[0];
    if (!selectedPickup) return setError("Nincs megadva személyes átvételi időpont.");
    const confirmed = window.confirm(
      `Kérjük, csak akkor erősítsd meg a foglalást, ha biztosan át tudod venni a terméket a választott időpontban.\n\nTermék: #${product.displayNumber}\nMéret: ${size}\nDarabszám: ${quantity} db\nÁtvétel: ${selectedPickup ? `${selectedPickup.address}, ${formatPickupRange(selectedPickup)}` : ""}\n\nMegerősíted a foglalást?`
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await api("/api/reservations", {
        method: "POST",
        body: JSON.stringify({ product_id: product.id, size, pickup_id: selectedPickup.id, quantity })
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
          <img src={imageUrl(displayImage)} alt={`#${product.displayNumber}`} />
        </div>
        <div className="product-detail-info">
          <h2>{productTitle(product)}</h2>
          <strong className="detail-price">{formatHuf(product.price)}</strong>
          <div className="quantity-row">
            <button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity((value) => value + 1)}>+</button>
            <em>db</em>
          </div>
          {activeReservation ? (
            <p className="reserved own-reservation">Saját foglalás: {activeReservation.size}, átvétel: {formatPickupRange(activeReservation.pickup)}</p>
          ) : (
          <div className="reserve-size-panel">
            <label>
              Méret
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                {product.sizes.map((item) => <option value={item.size} key={item.size}>{item.size}</option>)}
              </select>
            </label>
          </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="tdo-primary icon-text modal-reserve-button" disabled={busy || !!activeReservation || deadlineExpired || !pickups.length} onClick={reserve}>
            <ShoppingBag size={18} /> {deadlineExpired ? "A foglalási határidő lejárt" : activeReservation ? "Már lefoglalva" : "Lefoglalom személyes átvételre"}
          </button>
          <div className="detail-facts">
            <div><span>Elérhető Méretek:</span><strong>{product.sizes.map((s) => s.size).join(", ")}</strong></div>
            <div><span>Foglalható eddig:</span><strong>{tick >= 0 ? formatRemaining(product.reservableUntil) : ""}</strong></div>
            <div><span>Várható szállítás:</span><strong>{formatDateOnly(earliestPickup?.startAt)}</strong></div>
          </div>
          <button className={`wishlist-row ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite}>
            <Heart size={24} fill={isFavorite ? "currentColor" : "none"} />
            {isFavorite ? "Kívánságlistán" : "Kívánságlistára teszem"}
          </button>
        </div>
      </section>
    </section>
  );
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<AdminView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    onLogout();
  }
  if (view === "storefront") {
    return <CustomerStorefront user={user} onLogout={onLogout} onBackToAdmin={() => setView("dashboard")} />;
  }
  return (
    <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
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
          <button onClick={() => setView("new")} className={view === "new" ? "active" : ""}>1. Új termék</button>
          <button onClick={() => setView("ai")} className={view === "ai" ? "active" : ""}>2. AI-generálás</button>
          <button onClick={() => setView("share")} className={view === "share" ? "active" : ""}>3. Megosztás</button>
          <button onClick={() => setView("current")} className={view === "current" ? "active" : ""}>4. Jelenlegi kínálat</button>
          <button onClick={() => setView("orders")} className={view === "orders" ? "active" : ""}>5. Rendelők és rendelések</button>
          <button onClick={() => setView("pickup")} className={view === "pickup" ? "active" : ""}>6. Személyes átvétel megadása</button>
          <button onClick={() => setView("storefront")}>Felhasználói nézet</button>
          <button onClick={() => setView("deleted")} className={view === "deleted" ? "active" : ""}>Törölt tételek</button>
          <button onClick={() => setView("users")} className={view === "users" ? "active" : ""}>Regisztrált felhasználók</button>
        </nav>
        <button className="ghost icon-text" onClick={logout}><LogOut size={18} /> Kilépés</button>
      </aside>
      <main className="content">
        {view !== "dashboard" && (
          <button className="secondary icon-text admin-back-button" onClick={() => setView("dashboard")}>
            <ArrowLeft size={18} /> Vissza a főmenübe
          </button>
        )}
        {view === "dashboard" && <Dashboard onNew={() => setView("new")} onStorefront={() => setView("storefront")} onAi={() => setView("ai")} onShare={() => setView("share")} onCurrent={() => setView("current")} onOrders={() => setView("orders")} onPickup={() => setView("pickup")} />}
        {view === "new" && <ProductWizard onDone={() => setView("ai")} />}
        {view === "ai" && <AiGenerationQueue onShare={() => setView("share")} />}
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

function Dashboard({ onNew, onStorefront, onAi, onShare, onCurrent, onOrders, onPickup }: { onNew: () => void; onStorefront: () => void; onAi: () => void; onShare: () => void; onCurrent: () => void; onOrders: () => void; onPickup: () => void }) {
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
  const waitingForAi = products.filter((product) => product.status === "DRAFT" && product.images.some((image) => image.imageType === "ORIGINAL"));
  const aiGenerated = products.filter((product) => product.images.some((image) => image.imageType === "AI_GENERATED"));
  const current = products.filter((product) => product.status === "APPROVED");
  return (
    <>
      <header className="topbar">
        <h1>Dashboard</h1>
      </header>
      <div className="dashboard-actions">
        <button className="new-product-cta primary icon-text" onClick={onNew}><Plus size={30} /> 1. Új termék</button>
        <button className="storefront-cta secondary icon-text" onClick={onStorefront}><Eye size={26} /> Felhasználói nézet</button>
      </div>
      <PwaInstallPanel />
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
      </section>
    </>
  );
}

function ProductWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    product_id: "",
    product_name: "",
    price: "",
    available_sizes: [] as string[],
    category: "",
    description: "",
    reservable_until: "",
    reservable_duration_hours: "24",
    no_expiry: false
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pick(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  async function createAndUpload() {
    if (!file) return setError("Adj hozzá képet a folytatáshoz.");
    setBusy(true);
    setError("");
    try {
      const created = await api<{ product: Product }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          product_name: form.product_name || null,
          price: Number(form.price),
          category: form.category || null,
          reservable_until: form.no_expiry || !form.reservable_until ? null : new Date(form.reservable_until).toISOString(),
          reservable_duration_hours: form.no_expiry || form.reservable_until ? null : Number(form.reservable_duration_hours)
        })
      });
      const fd = new FormData();
      fd.append("image", file);
      const uploaded = await api<{ product: Product }>(`/api/products/${created.product.id}/image`, {
        method: "POST",
        body: fd
      });
      setProduct(uploaded.product);
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
              <input hidden type="file" accept="image/*,.heic,.heif" capture="environment" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </label>
            <label className="photo-action secondary icon-text">
              <Upload size={34} /> Kép feltöltése
              <input hidden type="file" accept="image/*,.heic,.heif" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="upload-zone">
            {preview ? <img src={preview} alt="Előnézet" /> : <Camera size={44} />}
          </div>
          {file && <button className="primary upload-next" onClick={() => setStep("data")}>Feltöltés és adatok megadása</button>}
        </div>
      )}
      {step === "data" && (
        <div className="panel form-grid product-data-form">
          <Text label="Product ID" value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
          <Text label="Termék megnevezése" value={form.product_name} onChange={(product_name) => setForm({ ...form, product_name })} />
          <Text label="Ár (Ft)" type="number" value={form.price} onChange={(price) => setForm({ ...form, price })} />
          <SizePicker value={form.available_sizes} onChange={(available_sizes) => setForm({ ...form, available_sizes })} />
          <Text label="Kategória" value={form.category} onChange={(category) => setForm({ ...form, category })} />
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
          <img src={imageUrl(original)} alt="Eredeti kép" />
          <div>
            <h2>Termék mentve</h2>
            <dl>
              <dt>Product ID</dt><dd>{product.productId}</dd>
              <dt>Termék megnevezése</dt><dd>{product.productName || "-"}</dd>
              <dt>Publikus sorszám</dt><dd>Honlapra megosztáskor kapja meg.</dd>
              <dt>Ár</dt><dd>{formatHuf(product.price)}</dd>
              <dt>Méretek</dt><dd>{product.sizes.map((s) => s.size).join("; ")}</dd>
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
        Lejárat nélkül
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

function AiGenerationQueue({ onShare }: { onShare: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await api<{ products: Product[] }>("/api/products?status=DRAFT");
    setProducts(res.products.filter((product) => product.images.some((image) => image.imageType === "ORIGINAL")));
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate(product: Product, gender: ModelGender) {
    setBusyId(product.id);
    setMessage("");
    setError("");
    try {
      await api<{ product: Product }>(`/api/products/${product.id}/generate`, {
        method: "POST",
        body: JSON.stringify({ gender })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generálási hiba");
    } finally {
      setBusyId(null);
    }
  }

  async function generateAll(gender: ModelGender) {
    if (!products.length || bulkBusy) return;
    const queue = [...products];
    const label = gender === "female" ? "Nő" : "Férfi";
    setBulkBusy(true);
    setError("");
    setMessage(`Generálás indul (${label}): 0/${queue.length}`);
    try {
      for (let index = 0; index < queue.length; index += 1) {
        const product = queue[index];
        setBusyId(product.id);
        setMessage(`Generálás folyamatban (${label}): ${index + 1}/${queue.length} (#${product.displayNumber})`);
        await api<{ product: Product }>(`/api/products/${product.id}/generate`, {
          method: "POST",
          body: JSON.stringify({ gender })
        });
      }
      setMessage(`Elkészült (${label}): ${queue.length}/${queue.length} AI-generálás.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generálási hiba");
      await load();
    } finally {
      setBusyId(null);
      setBulkBusy(false);
    }
  }

  async function remove(product: Product) {
    if (await deleteProduct(product)) await load();
  }

  return (
    <>
      <header className="topbar">
        <h1>AI-generálás</h1>
        <button className="secondary" onClick={onShare}>Megosztás</button>
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
          <span>{products.length} kép vár AI-generálásra</span>
        </section>
      )}
      <section className="cards">
        {products.map((product) => {
          const original = product.images.find((img) => img.imageType === "ORIGINAL");
          return (
            <article className="card" key={product.id}>
              <img src={imageUrl(original)} alt={`AI-generálásra vár ${product.displayNumber}`} />
              <div>
                <strong>#{product.displayNumber}</strong>
                <span>{product.productId}</span>
              </div>
              <p>{formatHuf(product.price)} · {product.sizes.map((s) => s.size).join("; ")}</p>
              <button className="primary icon-text full-width" disabled={bulkBusy || busyId === product.id} onClick={() => generate(product, "female")}>
                <Sparkles size={18} /> {busyId === product.id ? "Generálás..." : "AI-generálás (Nő)"}
              </button>
              <button className="secondary icon-text full-width" disabled={bulkBusy || busyId === product.id} onClick={() => generate(product, "male")}>
                <Sparkles size={18} /> AI-generálás (Férfi)
              </button>
              <button className="danger icon-text full-width" disabled={bulkBusy || busyId === product.id} onClick={() => remove(product)}>
                <Trash2 size={18} /> Törlés
              </button>
            </article>
          );
        })}
      </section>
      {products.length === 0 && <EmptyState title="Nincs AI-generálásra váró kép" />}
    </>
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
    const image = variant === "raw" ? productOriginalImage(product) : productGeneratedImage(product);
    if (!image) return;
    setBusyId(product.id);
    try {
      await downloadProductImage(product, image, variant);
    } finally {
      setBusyId(null);
    }
  }

  const originalOnly = products.filter((product) => productOriginalImage(product));
  const generated = products.filter((product) => productOriginalImage(product) || productGeneratedImage(product));

  return (
    <>
      <header className="topbar"><h1>Megosztás</h1></header>
      {message && <p className="success">{message}</p>}
      <ShareSection
        title="AI nélküli képek"
        hint="Eredeti feltöltött képek. Ezeket AI-generálás nélkül is letöltheted vagy kiteheted a honlapra."
        products={originalOnly}
        variant="raw"
        busyId={busyId}
        onDownload={downloadShareImage}
        onWebsite={publishToWebsite}
        onDeleted={load}
      />
      <ShareSection
        title="AI-generált képek"
        hint="AI-val előkészített képek letöltéshez és honlapra publikáláshoz."
        products={generated}
        variant="generated"
        busyId={busyId}
        onDownload={downloadShareImage}
        onWebsite={publishToWebsite}
        onDeleted={load}
      />
    </>
  );
}

function ShareSection({ title, hint, products, variant, busyId, onDownload, onWebsite, onDeleted }: {
  title: string;
  hint: string;
  products: Product[];
  variant: ShareVariant;
  busyId: number | null;
  onDownload: (product: Product, variant: ShareVariant) => Promise<void>;
  onWebsite: (product: Product) => Promise<void>;
  onDeleted: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(25);
  const visibleProducts = products.slice(0, visibleCount);
  const remaining = Math.max(0, products.length - visibleCount);

  useEffect(() => {
    setVisibleCount(25);
  }, [products.length, variant]);

  return (
    <section className="share-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <strong>{products.length} tétel</strong>
      </div>
      <div className="share-grid">
        {visibleProducts.map((product) => (
          <ShareCard
            product={product}
            variant={variant}
            busy={busyId === product.id}
            onDownload={() => onDownload(product, variant)}
            onWebsite={() => onWebsite(product)}
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
    </section>
  );
}

function ShareCard({ product, variant, busy, onDownload, onWebsite, onDeleted }: { product: Product; variant: ShareVariant; busy: boolean; onDownload: () => void; onWebsite: () => void; onDeleted: () => void }) {
  const image = variant === "raw" ? productOriginalImage(product) : productGeneratedImage(product);
  const url = imageUrl(image);
  const waitingForAi = variant === "generated" && !image;
  const [editing, setEditing] = useState(false);
  async function remove() {
    if (await deleteProduct(product)) onDeleted();
  }

  return (
    <article className="share-card">
      <div className="share-image-slot">
        {image ? (
          <img src={url} alt={`Megosztható termék ${product.displayNumber}`} />
        ) : (
          <div className="share-ai-pending" aria-label="AI-generálásra vár">
            <span className="pending-ban"><Ban size={32} /></span>
            <strong>AI-generálásra vár</strong>
            <small>Az eredeti kép megmaradt, az AI-verzió még nem készült el.</small>
          </div>
        )}
      </div>
      <div className="publish-panel">
        <h2>#{product.displayNumber}</h2>
        <span className="status-note">{variant === "raw" ? `Nyers kép: termek_${product.displayNumber}_nyers` : waitingForAi ? "AI-verzió még nincs kész" : "AI-generált kép"}</span>
        <dl>
          <dt>Product ID</dt><dd>{product.productId}</dd>
          <dt>Megnevezés</dt><dd>{product.productName || "-"}</dd>
          <dt>Ár</dt><dd>{formatHuf(product.price)}</dd>
          <dt>Méretek</dt><dd>{product.sizes.map((s) => s.size).join("; ")}</dd>
          <dt>Állapot</dt><dd>{product.status === "APPROVED" ? "Honlapon" : "Nincs honlapon"}</dd>
        </dl>
        <div className="big-action-grid">
          <button className="primary icon-text" disabled={busy || !image} onClick={onDownload}><Download size={20} /> Kép letöltése</button>
          <button className="secondary icon-text" disabled={busy || waitingForAi} onClick={onWebsite}><FolderCheck size={20} /> Honlapra</button>
          <button className="secondary icon-text" disabled={busy} onClick={() => setEditing((value) => !value)}><Eye size={20} /> Módosítás</button>
          <button className="danger icon-text" disabled={busy} onClick={remove}><Trash2 size={20} /> Törlés</button>
        </div>
        {editing && <ProductEditForm product={product} onSaved={() => { setEditing(false); onDeleted(); }} />}
      </div>
    </article>
  );
}

function ProductEditForm({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [form, setForm] = useState({
    product_id: product.productId,
    product_name: product.productName ?? "",
    price: String(product.price),
    available_sizes: product.sizes.map((size) => size.size),
    category: product.category ?? "",
    description: product.description ?? "",
    reservable_until: toLocalDateTimeInput(product.reservableUntil),
    no_expiry: !product.reservableUntil && !product.reservableDurationHours
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          product_id: form.product_id,
          product_name: form.product_name || null,
          price: Number(form.price),
          available_sizes: form.available_sizes,
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
      <SizePicker value={form.available_sizes} onChange={(available_sizes) => setForm({ ...form, available_sizes })} />
      <Text label="Kategória" value={form.category} onChange={(category) => setForm({ ...form, category })} />
      <label className="checkbox-line wide">
        <input
          type="checkbox"
          checked={form.no_expiry}
          onChange={(event) => setForm({ ...form, no_expiry: event.target.checked, reservable_until: event.target.checked ? "" : form.reservable_until })}
        />
        Lejárat nélkül
      </label>
      <Text label="Foglalható eddig" type="datetime-local" value={form.reservable_until} onChange={(reservable_until) => setForm({ ...form, reservable_until, no_expiry: false })} />
      <label className="wide">
        Leírás
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </label>
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
  return (
    <>
      <header className="topbar"><h1>Jelenlegi kínálat</h1></header>
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
                    <tr>
                      <td><img className="table-thumb" src={imageUrl(image)} alt={`Termék ${product.displayNumber}`} /></td>
                      <td>#{product.displayNumber}</td>
                      <td>{product.productName || "-"}</td>
                      <td>{formatHuf(product.price)}</td>
                      <td>{product.sizes.map((s) => s.size).join("; ")}</td>
                      <td>{product.category || "-"}</td>
                      <td>{formatReservationDeadline(product.reservableUntil)}</td>
                      <td>{reservedCount} db</td>
                      <td>
                        {productReservations.length ? (
                          <div className="reservation-mini-list">
                            {productReservations.map((reservation) => (
                              <span key={reservation.id}>{reservation.user?.username ?? "-"}: {reservation.quantity} db ({reservation.size})</span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="secondary table-action-btn" onClick={() => setEditingId(editingId === product.id ? null : product.id)}>Módosítás</button>
                          <button className="secondary table-action-btn" onClick={() => downloadCurrentImage(product)}>Letöltés</button>
                          <button className="danger table-action-btn" onClick={async () => { if (await deleteProduct(product)) await load(); }}>Törlés</button>
                        </div>
                      </td>
                    </tr>
                    {editingId === product.id && (
                      <tr>
                        <td colSpan={10}>
                          <ProductEditForm product={product} onSaved={async () => { setEditingId(null); await load(); }} />
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
                  <tr key={product.id}>
                    <td>{image ? <img className="table-thumb" src={imageUrl(image)} alt={`Törölt termék ${product.displayNumber}`} /> : "-"}</td>
                    <td>#{product.displayNumber}</td>
                    <td>{product.productId}</td>
                    <td>{product.productName || "-"}</td>
                    <td>{formatHuf(product.price)}</td>
                    <td>{product.sizes.map((s) => s.size).join("; ")}</td>
                    <td>{product.category || "-"}</td>
                    <td>
                      <button className="primary table-action-btn" disabled={busyId === product.id} onClick={() => restore(product)}>
                        Visszaállítás
                      </button>
                    </td>
                  </tr>
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
  const [error, setError] = useState("");

  async function load() {
    const res = await api<{ users: RegisteredUser[] }>("/api/auth/users");
    setUsers(res.users);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "A felhasználók betöltése sikertelen."));
  }, []);

  return (
    <>
      <header className="topbar">
        <h1>Regisztrált felhasználók</h1>
      </header>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Felhasználónév</th>
                <th>Vezetéknév</th>
                <th>Keresztnév</th>
                <th>Telefonszám</th>
                <th>E-mail</th>
                <th>Jogosultság</th>
                <th>Regisztráció</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((registeredUser) => (
                <tr key={registeredUser.id}>
                  <td>{registeredUser.username}</td>
                  <td>{registeredUser.lastName || "-"}</td>
                  <td>{registeredUser.firstName || "-"}</td>
                  <td>{registeredUser.phone || "-"}</td>
                  <td>{registeredUser.email || "-"}</td>
                  <td>{registeredUser.role === "ADMIN" ? "Admin" : "Felhasználó"}</td>
                  <td>{formatDateTime(registeredUser.createdAt)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="empty-table-cell">Még nincs regisztrált felhasználó.</td></tr>
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
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<{ reservations: Reservation[] }>("/api/reservations");
    setReservations(res.reservations);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "A rendelések betöltése sikertelen."));
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

  function exportOrdersXls() {
    const rows = reservations.map((reservation) => `
      <tr>
        <td>#${reservation.product.displayNumber}</td>
        <td>${reservation.product.productName ?? ""}</td>
        <td>${reservation.user?.username ?? "-"}</td>
        <td>${reservation.size}</td>
        <td>${reservation.quantity}</td>
        <td>${reservation.product.price}</td>
        <td>${reservationStatusLabels[reservation.status]}</td>
        <td>${reservation.pickup.address}</td>
        <td>${formatPickupRange(reservation.pickup)}</td>
        <td>${formatDateTime(reservation.reservedAt)}</td>
      </tr>
    `).join("");
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Termék</th>
                <th>Felhasználó</th>
                <th>Méret</th>
                <th>Darab</th>
                <th>Ár Ft</th>
                <th>Státusz</th>
                <th>Átvétel helye</th>
                <th>Átvétel ideje</th>
                <th>Foglalás ideje</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    downloadFile(`tunde-divat-rendelok-rendelesek-${new Date().toISOString().slice(0, 10)}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  }

  const sortedReservations = [...reservations].sort((a, b) => {
    const displayDiff = Number(a.product.displayNumber) - Number(b.product.displayNumber);
    if (Number.isFinite(displayDiff) && displayDiff !== 0) return displayDiff;
    return new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime();
  });

  return (
    <>
      <header className="topbar">
        <h1>Rendelők és rendelések</h1>
        <button className="secondary icon-text" onClick={exportOrdersXls}><Download size={18} /> XLS mentés</button>
      </header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sorszám</th>
                <th>Kép</th>
                <th>Felhasználó</th>
                <th>Ár</th>
                <th>Méret</th>
                <th>Darabszám</th>
                <th>Átvétel</th>
                <th>Foglalás ideje</th>
                <th>Státusz</th>
              </tr>
            </thead>
            <tbody>
              {sortedReservations.length ? sortedReservations.map((reservation) => {
                const image = productDisplayImage(reservation.product);
                return (
                  <tr key={reservation.id}>
                    <td>#{reservation.product.displayNumber}</td>
                    <td>{image ? <img className="table-thumb" src={imageUrl(image)} alt={`Rendelt termék ${reservation.product.displayNumber}`} /> : "-"}</td>
                    <td>{reservation.user?.username ?? "-"}</td>
                    <td>{formatHuf(reservation.product.price)}</td>
                    <td>{reservation.size}</td>
                    <td>{reservation.quantity} db</td>
                    <td>{reservation.pickup.address}, {formatPickupRange(reservation.pickup)}</td>
                    <td>{formatDateTime(reservation.reservedAt)}</td>
                    <td>
                      <select
                        className="status-select"
                        value={reservation.status}
                        disabled={busyId === reservation.id}
                        onChange={(event) => updateReservationStatus(reservation, event.target.value as ReservationStatus)}
                      >
                        {reservationStatuses.map((status) => (
                          <option value={status} key={status}>{reservationStatusLabels[status]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={9} className="empty-table-cell">Még nincs aktív rendelés.</td></tr>
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
    const rows = reservations.map((reservation) => `
      <tr>
        <td>${reservation.user?.username ?? "-"}</td>
        <td>#${reservation.product.displayNumber}</td>
        <td>${reservation.product.productId}</td>
        <td>${reservation.size}</td>
        <td>${reservation.quantity}</td>
        <td>${reservation.product.price}</td>
        <td>${reservation.pickup.address}</td>
        <td>${formatPickupRange(reservation.pickup)}</td>
        <td>${formatDateTime(reservation.reservedAt)}</td>
      </tr>
    `).join("");
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table>
            <thead>
              <tr>
                <th>Felhasználó</th>
                <th>#</th>
                <th>Product ID</th>
                <th>Méret</th>
                <th>Darab</th>
                <th>Ár Ft</th>
                <th>Átvétel helye</th>
                <th>Átvétel ideje</th>
                <th>Foglalás ideje</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    downloadFile(`tunde-divat-rendelesek-${new Date().toISOString().slice(0, 10)}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  }

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
          <button className="secondary icon-text" onClick={exportReservationsXls}><Download size={18} /> XLS mentés</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Felhasználó</th>
                <th>Termék</th>
                <th>Méret</th>
                <th>Ár</th>
                <th>Átvétel helye</th>
                <th>Átvétel ideje</th>
                <th>Foglalás ideje</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length ? reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.user?.username ?? "-"}</td>
                  <td>#{reservation.product.displayNumber}</td>
                  <td>{reservation.size}</td>
                  <td>{formatHuf(reservation.product.price)}</td>
                  <td>{reservation.pickup.address}</td>
                  <td>{formatPickupRange(reservation.pickup)}</td>
                  <td>{formatDateTime(reservation.reservedAt)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="empty-table-cell">Még nincs aktív foglalás.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ProductCard({ product, onDeleted }: { product: Product; onDeleted: () => void }) {
  const final = useMemo(() => [...product.images].reverse().find((img) => img.imageType === "FINAL"), [product]);
  const url = imageUrl(final);
  async function share() {
    const text = `#${product.displayNumber} - ${formatHuf(product.price)}\nMéretek: ${product.sizes.map((s) => s.size).join("; ")}`;
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
      <p>{formatHuf(product.price)} · {product.sizes.map((s) => s.size).join("; ")}</p>
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
