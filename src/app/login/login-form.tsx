"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Prijava nije uspela. Pokušaj ponovo.");
        return;
      }

      router.replace("/");
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušaj ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-grid" aria-hidden="true" />
      <section className="login-card">
        <Link className="brand brand-login" href="/login" aria-label="R2 Vault prijava">
          <span className="brand-mark">
            <CloudIcon />
          </span>
          <span>R2<span className="brand-light">vault</span></span>
        </Link>

        <div className="login-copy">
          <span className="eyebrow"><span className="status-dot" /> PRIVATNI STORAGE</span>
          <h1>Tvoj prostor.<br /><span>Tvoje datoteke.</span></h1>
          <p>Prijavi se da bezbedno pristupiš svom Cloudflare R2 skladištu.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="password">Lozinka</label>
          <div className="password-field">
            <input
              autoComplete="current-password"
              autoFocus
              id="password"
              maxLength={256}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Unesi pristupnu lozinku"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              <EyeIcon hidden={showPassword} />
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Provera..." : "Prijavi se"}
            {!isSubmitting && <ArrowIcon />}
          </button>
        </form>

        <div className="login-foot">
          <LockIcon />
          <span>Veza je zaštićena enkripcijom i privatnom sesijom.</span>
        </div>
      </section>
      <footer className="login-footer">R2 VAULT <span>·</span> PRIVATNI CLOUDFLARE STORAGE</footer>
    </main>
  );
}

function CloudIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M7.5 18.5h10a4 4 0 0 0 .4-8 6.5 6.5 0 0 0-12.4 1.8 3.2 3.2 0 0 0 2 6.2Z" />
      <path d="m9.5 13.5 2.5-2.5 2.5 2.5M12 11v6" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {hidden ? (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      ) : (
        <>
          <path d="m3 3 18 18M10.6 6.2A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-3.1 3.5M6.2 6.7C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 2.2-.3" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M4 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="8" rx="1.5" width="12" x="4" y="9" />
      <path d="M6.5 9V6a3.5 3.5 0 1 1 7 0v3m-3.5 3v2" />
    </svg>
  );
}
