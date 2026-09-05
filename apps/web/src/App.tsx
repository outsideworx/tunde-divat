import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Menu, PanelLeftClose } from "lucide-react";
import { api } from "./lib/api.js";
import type { AdminView, User } from "./types.js";
import { Login } from "./views/Login.js";
import { CustomerStorefront } from "./views/CustomerStorefront.js";
import { Dashboard } from "./views/Dashboard.js";
import { ProductWizard } from "./views/ProductWizard.js";
import { AiGenerationQueue } from "./views/AiGenerationQueue.js";
import { ShareCenter } from "./views/ShareCenter.js";
import { CurrentOfferings } from "./views/CurrentOfferings.js";
import { Orders } from "./views/Orders.js";
import { PickupSettings } from "./views/PickupSettings.js";
import { DeletedProducts, RegisteredUsers } from "./views/DeletedProducts.js";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="boot">Betöltés...</div>;
  if (!user) return <Login onLogin={setUser} />;
  if (user.role !== "ADMIN") return <CustomerStorefront user={user} onLogout={() => setUser(null)} />;
  return <Shell user={user} onLogout={() => setUser(null)} />;
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<AdminView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    onLogout();
  }
  if (view === "storefront") {
    return <CustomerStorefront user={user} onLogout={onLogout} onBackToAdmin={() => setView("dashboard")} />;
  }
  return (
    <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <div>
            <strong>Tünde Divat Online</strong>
            <span>{user.username}</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Menü megnyitása" : "Menü becsukása"}>
            {sidebarCollapsed ? <Menu size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        <nav>
          <button onClick={() => setView("dashboard")} className={view === "dashboard" ? "active" : ""}>Dashboard</button>
          <button onClick={() => setView("new")} className={view === "new" ? "active" : ""}>1. Új termék</button>
          <button onClick={() => setView("ai")} className={view === "ai" ? "active" : ""}>2. AI-generálás</button>
          <button onClick={() => setView("share")} className={view === "share" ? "active" : ""}>3. Megosztás</button>
          <button onClick={() => setView("current")} className={view === "current" ? "active" : ""}>4. Jelenlegi kínálat</button>
          <button onClick={() => setView("orders")} className={view === "orders" ? "active" : ""}>5. Rendelők és rendelések</button>
          <button onClick={() => setView("pickup")} className={view === "pickup" ? "active" : ""}>6. Személyes átvétel megadása</button>
          <button onClick={() => setView("storefront")}>Felhasználói nézet</button>
          <button onClick={() => setView("deleted")} className={view === "deleted" ? "active" : ""}>Törölt tételek</button>
          <button onClick={() => setView("users")} className={view === "users" ? "active" : ""}>Regisztrált felhasználók</button>
        </nav>
        <button className="ghost icon-text" onClick={logout}><LogOut size={18} /> Kilépés</button>
      </aside>
      <main className="content">
        {view !== "dashboard" && (
          <button className="secondary icon-text admin-back-button" onClick={() => setView("dashboard")}>
            <ArrowLeft size={18} /> Vissza a főmenübe
          </button>
        )}
        {view === "dashboard" && <Dashboard onNew={() => setView("new")} onStorefront={() => setView("storefront")} onAi={() => setView("ai")} onShare={() => setView("share")} onCurrent={() => setView("current")} onOrders={() => setView("orders")} onPickup={() => setView("pickup")} />}
        {view === "new" && <ProductWizard onDone={() => setView("ai")} />}
        {view === "ai" && <AiGenerationQueue onShare={() => setView("share")} />}
        {view === "share" && <ShareCenter />}
        {view === "current" && <CurrentOfferings />}
        {view === "orders" && <Orders />}
        {view === "pickup" && <PickupSettings />}
        {view === "deleted" && <DeletedProducts />}
        {view === "users" && <RegisteredUsers />}
      </main>
    </div>
  );
}
