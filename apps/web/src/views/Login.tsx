import { useState } from "react";
import { api } from "../lib/api.js";
import { REMEMBER_LOGIN_KEY, REMEMBERED_USERNAME_KEY } from "../lib/labels.js";
import type { AuthMode, User } from "../types.js";

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [rememberLogin, setRememberLogin] = useState(() => window.localStorage.getItem(REMEMBER_LOGIN_KEY) === "true");
  const [username, setUsername] = useState(() => window.localStorage.getItem(REMEMBER_LOGIN_KEY) === "true" ? window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? "" : "");
  const [password, setPassword] = useState("");
  const [registerForm, setRegisterForm] = useState({
    username: "",
    last_name: "",
    first_name: "",
    phone: "",
    password: "",
    invite_code: ""
  });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const res = await api<{ user: User }>(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify(authMode === "login" ? { username, password } : registerForm)
      });
      if (authMode === "login") {
        if (rememberLogin) {
          window.localStorage.setItem(REMEMBER_LOGIN_KEY, "true");
          window.localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
        } else {
          window.localStorage.removeItem(REMEMBER_LOGIN_KEY);
          window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
        }
      }
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sikertelen művelet");
    }
  }

  function setRegister<K extends keyof typeof registerForm>(key: K, value: string) {
    setRegisterForm((current) => ({ ...current, [key]: value }));
  }

  function updateRememberLogin(checked: boolean) {
    setRememberLogin(checked);
    if (!checked) {
      window.localStorage.removeItem(REMEMBER_LOGIN_KEY);
      window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  }

  return (
    <main className="auth-shell">
      <span className="build-version">ver.: alpha 0.2</span>
      <section className="brand-panel">
        <div />
        <div>
          <img className="auth-logo" src="/assets/tunde-divat-online-logo.jpeg" alt="Tünde Divat Online" />
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit} autoComplete={rememberLogin ? "on" : "off"}>
          <div className="auth-tabs">
            <button className={`tab-button ${authMode === "login" ? "active" : ""}`} type="button" onClick={() => setAuthMode("login")}>Bejelentkezés</button>
            <button className={`tab-button ${authMode === "register" ? "active" : ""}`} type="button" onClick={() => setAuthMode("register")}>Regisztráció</button>
          </div>
          <h1>Tünde Divat Online</h1>
          {authMode === "login" ? (
            <>
              <label>
                Felhasználónév
                <input
                  value={username}
                  name={rememberLogin ? "username" : "tdo-login-user"}
                  onChange={(e) => setUsername(e.target.value)}
                  type="text"
                  autoComplete={rememberLogin ? "username" : "off"}
                />
              </label>
              <label>
                Jelszó
                <input
                  value={password}
                  name={rememberLogin ? "password" : "tdo-login-pass"}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={rememberLogin ? "current-password" : "new-password"}
                />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={rememberLogin} onChange={(event) => updateRememberLogin(event.target.checked)} />
                <span>Emlékezzen rám</span>
              </label>
            </>
          ) : (
            <>
              <label>Felhasználónév<input value={registerForm.username} onChange={(e) => setRegister("username", e.target.value)} type="text" autoComplete="username" /></label>
              <label>Vezetéknév<input value={registerForm.last_name} onChange={(e) => setRegister("last_name", e.target.value)} type="text" autoComplete="family-name" /></label>
              <label>Keresztnév<input value={registerForm.first_name} onChange={(e) => setRegister("first_name", e.target.value)} type="text" autoComplete="given-name" /></label>
              <label>Telefonszám<input value={registerForm.phone} onChange={(e) => setRegister("phone", e.target.value)} type="tel" autoComplete="tel" /></label>
              <label>Jelszó<input value={registerForm.password} onChange={(e) => setRegister("password", e.target.value)} type="password" autoComplete="new-password" /></label>
              <label>Meghívókód<input value={registerForm.invite_code} onChange={(e) => setRegister("invite_code", e.target.value)} type="text" /></label>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary tdo-primary" type="submit">{authMode === "login" ? "Bejelentkezés" : "Regisztráció"}</button>
        </form>
      </section>
    </main>
  );
}
