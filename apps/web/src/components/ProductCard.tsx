import { useEffect, useMemo, useState } from "react";
import { Download, FolderCheck, Share2, Trash2 } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { imageUrl } from "../lib/api.js";
import { deleteProduct } from "../lib/images.js";
import type { BeforeInstallPromptEvent, Product } from "../types.js";

export function ProductCard({ product, onDeleted }: { product: Product; onDeleted: () => void }) {
  const final = useMemo(() => [...product.images].reverse().find((img) => img.imageType === "FINAL"), [product]);
  const url = imageUrl(final);
  async function share() {
    const text = `#${product.displayNumber} - ${formatHuf(product.price)}\nMéretek: ${product.sizes.map((s) => s.size).join("; ")}`;
    if (navigator.share) {
      await navigator.share({ title: `Termék ${product.displayNumber}`, text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert("A posztszöveg és kép linkje a vágólapra került.");
    }
  }
  async function remove() {
    if (await deleteProduct(product)) onDeleted();
  }
  return (
    <article className="card">
      <img src={url} alt={`Termék ${product.displayNumber}`} />
      <div>
        <strong>#{product.displayNumber}</strong>
        <span>{product.productId}</span>
      </div>
      <p>{formatHuf(product.price)} · {product.sizes.map((s) => s.size).join("; ")}</p>
      <time>{new Date(product.createdAt).toLocaleDateString("hu-HU")}</time>
      <div className="button-row">
        <a className="button icon-text" href={url} target="_blank"><FolderCheck size={18} /> Megtekintés</a>
        <a className="button secondary icon-text" href={url} download><Download size={18} /> Letöltés</a>
        <button className="secondary icon-text" onClick={share}><Share2 size={18} /> Megosztás</button>
        <button className="danger icon-text" onClick={remove}><Trash2 size={18} /> Törlés</button>
      </div>
    </article>
  );
}

export function PwaInstallPanel() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setMessage("");
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setMessage("Az app telepítve van ezen az eszközön.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installed) {
      setMessage("Az app már telepített nézetben fut.");
      return;
    }
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      setMessage(choice.outcome === "accepted" ? "Telepítés elindítva." : "A telepítést most kihagytad.");
      return;
    }
    setMessage("iPhone-on: Safari megosztás ikon, majd Hozzáadás a Főképernyőhöz. Androidon: Chrome menü, majd Alkalmazás telepítése.");
  }

  return (
    <section className="panel pwa-install-panel">
      <div>
        <span>Telefonos admin app</span>
        <strong>{installed ? "Telepített nézet aktív" : "App telepítése telefonra"}</strong>
      </div>
      <button className="tdo-primary icon-text" onClick={install}>
        <Download size={22} /> {installed ? "Megnyitva appként" : "App telepítése telefonra"}
      </button>
      {message && <p className="status-note">{message}</p>}
    </section>
  );
}
