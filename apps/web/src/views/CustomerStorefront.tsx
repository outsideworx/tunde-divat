import { useEffect, useState } from "react";
import { ArrowLeft, FolderCheck, Heart, LogOut, Search, ShoppingBag } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { api } from "../lib/api.js";
import { favoritesKey } from "../lib/labels.js";
import { productDisplayImage } from "../lib/images.js";
import { useProductRoute } from "../hooks/useProductRoute.js";
import { ProductGrid } from "../components/storefront.js";
import type { PickupOption, Product, Reservation, StoreView, User } from "../types.js";
import { ProductDetailPage, ReservationsPage } from "./ProductDetailPage.js";

export function CustomerStorefront({ user, onLogout, onBackToAdmin }: { user: User; onLogout: () => void; onBackToAdmin?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pickups, setPickups] = useState<PickupOption[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [storeView, setStoreView] = useState<StoreView>("catalog");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const { productId: detailProductId, openProduct, clearProduct } = useProductRoute();
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
    const raw = window.localStorage.getItem(favoritesKey(user.id));
    setFavoriteIds(raw ? JSON.parse(raw) as number[] : []);
  }, [user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
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
      window.localStorage.setItem(favoritesKey(user.id), JSON.stringify(next));
      return next;
    });
  }

  function openProductDetail(product: Product) {
    openProduct(product.id);
  }

  function closeProductDetail() {
    clearProduct();
    setStoreView("catalog");
  }

  function goToStoreView(nextView: StoreView) {
    if (detailProductId !== null) {
      clearProduct(false);
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
