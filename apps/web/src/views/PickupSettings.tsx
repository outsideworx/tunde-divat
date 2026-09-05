import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { api } from "../lib/api.js";
import { downloadFile } from "../lib/images.js";
import { formatDateTime, formatPickupRange, localDateAt } from "../lib/format.js";
import { Text } from "../components/forms.js";
import type { PickupOption, Reservation } from "../types.js";

export function PickupSettings() {
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
