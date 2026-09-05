import { Heart } from "lucide-react";
import { formatHuf } from "@fashion-mvp/shared";
import { imageUrl } from "../lib/api.js";
import { productDisplayImage } from "../lib/images.js";
import { formatRemaining, isDeadlineUrgent, productTitle } from "../lib/format.js";
import type { Product } from "../types.js";

export function StoreProductCard({ product, isFavorite, onToggleFavorite, onOpenDetail, tick }: {
  product: Product;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenDetail: () => void;
  tick: number;
}) {
  const displayImage = productDisplayImage(product);
  return (
    <article className="store-card">
      <div className="store-image-wrap">
        <button className="store-image-button" onClick={onOpenDetail}>
          <img src={imageUrl(displayImage)} alt={`#${product.displayNumber}`} />
        </button>
        <button className={`favorite-button ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite} aria-label={isFavorite ? "Eltávolítás a kedvencekből" : "Kedvencekhez adás"}>
          <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="store-card-summary" onClick={onOpenDetail}>
        <span>{productTitle(product)}</span>
        <strong>{formatHuf(product.price)}</strong>
        <small className="deadline-countdown">
          Foglalható eddig: <b className={isDeadlineUrgent(product.reservableUntil) ? "urgent" : ""}>{tick >= 0 ? formatRemaining(product.reservableUntil) : ""}</b>
        </small>
      </button>
    </article>
  );
}

export function ProductGrid({ products, favoriteIds, onToggleFavorite, onOpenDetail, tick }: {
  products: Product[];
  favoriteIds: number[];
  onToggleFavorite: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
  tick: number;
}) {
  return (
    <section className="store-grid">
      {products.map((product) => (
        <StoreProductCard
          product={product}
          isFavorite={favoriteIds.includes(product.id)}
          onToggleFavorite={() => onToggleFavorite(product)}
          onOpenDetail={() => onOpenDetail(product)}
          tick={tick}
          key={product.id}
        />
      ))}
    </section>
  );
}
