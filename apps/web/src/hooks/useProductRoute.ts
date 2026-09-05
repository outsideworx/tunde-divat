import { useCallback, useEffect, useState } from "react";

export function productIdFromPath() {
  const match = window.location.pathname.match(/^\/product\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

// Minimal client-side route for the storefront product detail page. Mirrors the
// previous inline pushState logic but centralizes it so navigation is consistent
// and popstate is handled in one place.
export function useProductRoute() {
  const [productId, setProductId] = useState<number | null>(() => productIdFromPath());

  useEffect(() => {
    const onPopState = () => setProductId(productIdFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openProduct = useCallback((id: number) => {
    window.history.pushState({}, "", `/product/${id}`);
    setProductId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const clearProduct = useCallback((scroll = true) => {
    window.history.pushState({}, "", "/");
    setProductId(null);
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { productId, openProduct, clearProduct };
}
