"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StorageHeader, {
  type StorageStatus,
} from "../components/storage-header";

type StoredFile = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
};

const PAGE_SIZE = 100;

class UnauthorizedError extends Error {}

async function requestFiles(cursor?: string) {
  const params = new URLSearchParams({ view: "all" });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/objects?${params.toString()}`, {
    cache: "no-store",
  });
  if (response.status === 401) throw new UnauthorizedError();

  const result = (await response.json()) as {
    files?: StoredFile[];
    nextToken?: string | null;
    error?: string;
  };
  if (!response.ok || !result.files) {
    throw new Error(result.error ?? "Fajlove nije moguće učitati.");
  }
  return { files: result.files, nextToken: result.nextToken ?? null };
}

export default function FilesBrowser() {
  const router = useRouter();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("checking");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      try {
        const result = await requestFiles(cursor);
        setFiles((current) =>
          append ? [...current, ...result.files] : result.files,
        );
        setNextToken(result.nextToken);
        setStorageStatus("connected");
      } catch (loadError) {
        if (loadError instanceof UnauthorizedError) {
          router.replace("/login");
          return;
        }
        setStorageStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Fajlove nije moguće učitati.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let active = true;
    void requestFiles()
      .then((result) => {
        if (!active) return;
        setFiles(result.files);
        setNextToken(result.nextToken);
        setStorageStatus("connected");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (loadError instanceof UnauthorizedError) {
          router.replace("/login");
          return;
        }
        setStorageStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Fajlove nije moguće učitati.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function getFileUrl(key: string, purpose: "copy" | "download") {
    const response = await fetch(
      `/api/download?key=${encodeURIComponent(key)}&purpose=${purpose}`,
      { cache: "no-store" },
    );
    if (response.status === 401) {
      router.replace("/login");
      return null;
    }
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url)
      throw new Error(result.error ?? "Link nije dostupan.");
    return result.url;
  }

  async function copyFileLink(file: StoredFile) {
    setError("");
    setCopyNotice("");
    try {
      const url = await getFileUrl(file.key, "copy");
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopyNotice(
        `Link za „${file.name}” je kopiran. Važi 15 minuta; svako ko ga ima može preuzeti fajl.`,
      );
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Link nije moguće kopirati.",
      );
    }
  }

  async function downloadFile(file: StoredFile) {
    setError("");
    try {
      const url = await getFileUrl(file.key, "download");
      if (url) window.location.assign(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Fajl nije moguće preuzeti.",
      );
    }
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  return (
    <main className="dashboard-shell">
      <StorageHeader currentPage="files" storageStatus={storageStatus} />
      <section className="dashboard-content files-page-content">
        <div className="welcome-row files-page-welcome">
          <div>
            <span className="eyebrow">CLOUDFLARE R2 · PRIVATNI BUCKET</span>
            <h1>
              Svi <span>fajlovi.</span>
            </h1>
            <p>
              Pregledaj objekte u bucket-u i kopiraj privremeni link za
              preuzimanje.
            </p>
          </div>
          <Link className="button button-primary upload-more-button" href="/">
            Otpremi fajlove <ArrowIcon />
          </Link>
        </div>

        <section className="panel all-files-panel">
          <div className="all-files-heading">
            <div>
              <span className="eyebrow">PREGLED STORAGE-A</span>
              <h2>Fajlovi u bucket-u</h2>
              <p>
                {files.length} učitanih fajlova <span>·</span>{" "}
                {formatBytes(totalBytes)}
              </p>
            </div>
            <button
              className="icon-button"
              disabled={isLoading || isLoadingMore}
              onClick={() => {
                setError("");
                setFiles([]);
                setNextToken(null);
                setIsLoading(true);
                void loadPage();
              }}
              type="button"
              aria-label="Osveži fajlove"
            >
              <RefreshIcon />
            </button>
          </div>

          <div className="link-expiry-note">
            <LockIcon />
            <span>
              Kopirani link traje 15 minuta. Svako ko dobije link može preuzeti
              fajl dok ne istekne.
            </span>
          </div>
          {copyNotice && (
            <p className="copy-notice" role="status">
              <CheckIcon />
              {copyNotice}
            </p>
          )}
          {error && (
            <p className="load-error" role="alert">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="empty-state">
              <span className="mini-spinner" />
              <p>Učitavanje fajlova...</p>
            </div>
          ) : files.length === 0 && !error ? (
            <div className="empty-state">
              <span className="empty-icon">
                <FolderIcon />
              </span>
              <strong>Storage je prazan</strong>
              <p>Otpremi fajl da bi se pojavio ovde.</p>
            </div>
          ) : files.length > 0 ? (
            <div className="all-files-list">
              <div className="all-files-columns">
                <span>FAJL</span>
                <span>VELIČINA</span>
                <span>DATUM</span>
                <span />
              </div>
              {files.map((file) => (
                <article className="stored-file all-stored-file" key={file.key}>
                  <span className="file-icon file-icon-stored">
                    <FileIcon />
                  </span>
                  <div className="stored-file-info">
                    <strong title={file.name}>{file.name}</strong>
                    <span className="mobile-file-meta">
                      {formatBytes(file.size)} <i>·</i>{" "}
                      {file.lastModified ? formatDate(file.lastModified) : "—"}
                    </span>
                  </div>
                  <span className="desktop-file-meta">
                    {formatBytes(file.size)}
                  </span>
                  <span className="desktop-file-meta desktop-file-date">
                    {file.lastModified ? formatDate(file.lastModified) : "—"}
                  </span>
                  <div className="file-actions">
                    <button
                      aria-label={`Kopiraj link za ${file.name}`}
                      className="icon-button"
                      onClick={() => void copyFileLink(file)}
                      type="button"
                    >
                      <CopyIcon />
                    </button>
                    <button
                      aria-label={`Preuzmi ${file.name}`}
                      className="download-button"
                      onClick={() => void downloadFile(file)}
                      type="button"
                    >
                      <DownloadIcon />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {nextToken && !isLoading && (
            <button
              className="load-more-button"
              disabled={isLoadingMore}
              onClick={() => {
                setError("");
                setIsLoadingMore(true);
                void loadPage(nextToken, true);
              }}
              type="button"
            >
              {isLoadingMore ? (
                <>
                  <span className="mini-spinner" /> Učitavanje...
                </>
              ) : (
                <>
                  Učitaj još fajlova <span>({PAGE_SIZE})</span>
                </>
              )}
            </button>
          )}
          <div className="files-footer">
            <span>
              <span className={`status-dot status-dot-${storageStatus}`} />{" "}
              {storageStatus === "connected"
                ? "Povezano sa R2"
                : storageStatus === "checking"
                  ? "Provera veze"
                  : "R2 nije dostupan"}
            </span>
            <span>{nextToken ? "Prikaz u stranicama" : "Kraj liste"}</span>
          </div>
        </section>
        <footer className="dashboard-footer">
          <span>
            R2 VAULT <span className="footer-separator">·</span> CLOUDFLARE
            STORAGE
          </span>
          <span>
            &copy;{" "}
            <a
              href="https://github.com/Mikilicc"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mikilic
            </a>
          </span>
        </footer>
      </section>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sr-Latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <path d="M3.5 9h11m-4.5-4.5L14.5 9 10 13.5" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="11" rx="2" width="9" x="7.5" y="6.5" />
      <path d="M12.5 3.5h-7a2 2 0 0 0-2 2v9" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 22 22">
      <path d="M12 3H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M12 3v6h6" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 32 32">
      <path d="M4 9a2 2 0 0 1 2-2h7l3 3h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M4.5 13h23" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <rect height="7.5" rx="1.5" width="11" x="3.5" y="8" />
      <path d="M5.5 8V5.5a3.5 3.5 0 1 1 7 0V8m-3.5 3v1.5" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <path d="m3.5 9.5 3.5 3.5 7.5-8" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M16.5 6.5A7 7 0 0 0 4.2 5L3 6.5m0 0V3m0 3.5h3.5M3.5 13.5A7 7 0 0 0 15.8 15L17 13.5m0 0V17m0-3.5h-3.5" />
    </svg>
  );
}
