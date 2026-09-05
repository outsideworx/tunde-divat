import { useState } from "react";
import { api } from "../lib/api.js";
import { toLocalDateTimeInput } from "../lib/format.js";
import type { Product } from "../types.js";
import { SizePicker, Text } from "./forms.js";

export function ProductEditForm({ product, onSaved }: { product: Product; onSaved: () => void }) {
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
