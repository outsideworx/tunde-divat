import { useEffect, useState } from "react";
import { ArrowLeft, Heart, ShoppingBag } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import { productDisplayImage } from "../lib/images.js";
import { formatDateOnly, formatPickupRange, formatRemaining, productTitle } from "../lib/format.js";
import type { PickupOption, Product, Reservation } from "../types.js";

export function ProductDetailPage({ product, pickups, reservations, isFavorite, earliestPickup, onClose, onToggleFavorite, onReserved }: {
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

export function ReservationsPage({ reservations, onBackToCatalog, onCancel }: { reservations: Reservation[]; onBackToCatalog: () => void; onCancel: (reservation: Reservation) => Promise<void> }) {
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
