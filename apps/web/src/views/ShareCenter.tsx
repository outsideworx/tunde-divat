import { useEffect, useState } from "react";
import { Ban, Download, Eye, FolderCheck, Trash2 } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { api, imageUrl } from "../lib/api.js";
import {
  deleteProduct,
  downloadProductImage,
  productGeneratedImage,
  productOriginalImage
} from "../lib/images.js";
import { EmptyState } from "../components/forms.js";
import { ProductEditForm } from "../components/ProductEditForm.js";
import type { Product, ShareVariant } from "../types.js";

export function ShareCenter() {
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
