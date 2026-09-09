import { Fragment, useEffect, useState } from "react";
import { formatHuf } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import { deleteProduct, downloadProductImage, productDisplayImage, productGeneratedImage } from "../lib/images.js";
import { formatReservationDeadline } from "../lib/format.js";
import { ProductEditForm } from "../components/ProductEditForm.js";
import type { Product, Reservation } from "../types.js";

export function CurrentOfferings() {
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
