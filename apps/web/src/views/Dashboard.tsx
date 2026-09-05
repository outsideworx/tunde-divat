import { useEffect, useState } from "react";
import { Eye, KeyRound, Plus } from "lucide-react";
import { api } from "../lib/api.js";
import { PwaInstallPanel } from "../components/ProductCard.js";
import type { Product } from "../types.js";

export function Dashboard({ onNew, onStorefront, onAi, onShare, onCurrent, onOrders, onPickup }: { onNew: () => void; onStorefront: () => void; onAi: () => void; onShare: () => void; onCurrent: () => void; onOrders: () => void; onPickup: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  useEffect(() => {
    api<{ products: Product[] }>("/api/products").then((res) => setProducts(res.products));
  }, []);
  useEffect(() => {
    if (!inviteOpen) return;
    api<{ invite_code: string }>("/api/auth/invite-code")
      .then((res) => setInviteCode(res.invite_code))
      .catch((err) => setInviteError(err instanceof Error ? err.message : "A meghívókód betöltése sikertelen."));
  }, [inviteOpen]);

  async function saveInviteCode(event: React.FormEvent) {
    event.preventDefault();
    setInviteError("");
    setInviteMessage("");
    try {
      const res = await api<{ invite_code: string }>("/api/auth/invite-code", {
        method: "PUT",
        body: JSON.stringify({ invite_code: inviteCode })
      });
      setInviteCode(res.invite_code);
      setInviteMessage("Meghívókód mentve.");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "A meghívókód mentése sikertelen.");
    }
  }
  const waitingForAi = products.filter((product) => product.status === "DRAFT" && product.images.some((image) => image.imageType === "ORIGINAL"));
  const aiGenerated = products.filter((product) => product.images.some((image) => image.imageType === "AI_GENERATED"));
  const current = products.filter((product) => product.status === "APPROVED");
  return (
    <>
      <header className="topbar">
        <h1>Dashboard</h1>
      </header>
      <div className="dashboard-actions">
        <button className="new-product-cta primary icon-text" onClick={onNew}><Plus size={30} /> 1. Új termék</button>
        <button className="storefront-cta secondary icon-text" onClick={onStorefront}><Eye size={26} /> Felhasználói nézet</button>
      </div>
      <PwaInstallPanel />
      <section className="dashboard-list">
        <button className="dashboard-row" onClick={onAi}>
          <span>2. AI-generálásra vár</span>
          <strong>{waitingForAi.length}</strong>
        </button>
        <button className="dashboard-row" onClick={onShare}>
          <span>3. Megosztható képek</span>
          <strong>{aiGenerated.length}</strong>
        </button>
        <button className="dashboard-row" onClick={onCurrent}>
          <span>4. Jelenlegi kínálat</span>
          <strong>{current.length}</strong>
        </button>
        <button className="dashboard-row" onClick={onOrders}>
          <span>5. Rendelők és rendelések</span>
          <strong>→</strong>
        </button>
        <button className="dashboard-row" onClick={onPickup}>
          <span>6. Személyes átvétel megadása</span>
          <strong>→</strong>
        </button>
      </section>
      <section className="panel invite-panel">
        <button className="secondary icon-text" onClick={() => setInviteOpen((value) => !value)}>
          <KeyRound size={18} /> Meghívókód megadása
        </button>
        {inviteOpen && (
          <form className="invite-form" onSubmit={saveInviteCode}>
            <label>
              Meghívókód
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} type="text" />
            </label>
            {inviteError && <p className="error">{inviteError}</p>}
            {inviteMessage && <p className="success">{inviteMessage}</p>}
            <button className="primary" type="submit">Mentés</button>
          </form>
        )}
      </section>
    </>
  );
}
