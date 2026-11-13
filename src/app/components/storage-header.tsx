"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type StorageStatus = "checking" | "connected" | "error";
type StoragePage = "home" | "files";

export default function StorageHeader({
  storageStatus,
  currentPage,
}: {
  storageStatus: StorageStatus;
  currentPage: StoragePage;
}) {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState("");

  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Odjava trenutno nije uspela.");
      router.replace("/login");
    } catch {
      setLogoutError("Odjava trenutno nije uspela. Pokušaj ponovo.");
    }
  }

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="R2 Vault početna">
        <span className="brand-mark"><CloudIcon /></span>
        <span>R2<span className="brand-light">vault</span></span>
      </Link>
      <div className="topbar-right">
        <details className="nav-dropdown">
          <summary>
            Skladište
            <ChevronIcon />
          </summary>
          <nav aria-label="Navigacija skladišta" className="nav-menu">
            <Link aria-current={currentPage === "home" ? "page" : undefined} href="/">
              Početna
            </Link>
            <Link aria-current={currentPage === "files" ? "page" : undefined} href="/files">
              Svi fajlovi
            </Link>
          </nav>
        </details>
        <span className="connection-status">
          <span className={`status-dot status-dot-${storageStatus}`} />
          {storageStatus === "connected" ? "R2 storage povezan" : storageStatus === "checking" ? "Provera R2 veze" : "R2 nije dostupan"}
        </span>
        <span className="topbar-divider" />
        <button className="logout-button" onClick={logout} type="button">
          <LogoutIcon /> Odjavi se
        </button>
      </div>
      {logoutError && <p className="logout-error" role="alert">{logoutError}</p>}
    </header>
  );
}

function CloudIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M7.5 18.5h10a4 4 0 0 0 .4-8 6.5 6.5 0 0 0-12.4 1.8 3.2 3.2 0 0 0 2 6.2Z" /><path d="m9.5 13.5 2.5-2.5 2.5 2.5M12 11v6" /></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>;
}

function LogoutIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3M12 13l3-3-3-3m3 3H7" /></svg>;
}
