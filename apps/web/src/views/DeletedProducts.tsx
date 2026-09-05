import { useEffect, useState } from "react";
import { formatHuf } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import { productDisplayImage } from "../lib/images.js";
import { formatDateTime } from "../lib/format.js";
import type { Product, RegisteredUser } from "../types.js";

export function DeletedProducts() {
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

export function RegisteredUsers() {
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
