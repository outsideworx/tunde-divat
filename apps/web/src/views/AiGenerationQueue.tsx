import { useEffect, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import { deleteProduct } from "../lib/images.js";
import { EmptyState } from "../components/forms.js";
import type { ModelGender, Product } from "../types.js";

export function AiGenerationQueue({ onShare }: { onShare: () => void }) {
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
