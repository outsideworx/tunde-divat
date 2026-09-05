import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatHuf, reservationStatuses, type ReservationStatus } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import { downloadFile, productDisplayImage } from "../lib/images.js";
import { formatDateTime, formatPickupRange } from "../lib/format.js";
import { reservationStatusLabels } from "../lib/labels.js";
import type { Reservation } from "../types.js";

export function Orders() {
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
