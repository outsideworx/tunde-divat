import { useState } from "react";
import { Camera, Upload } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import { ReservationDeadlinePicker, SizePicker, Stepper, Text } from "../components/forms.js";
import type { Product, Step } from "../types.js";

export function ProductWizard({ onDone }: { onDone: () => void }) {
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
