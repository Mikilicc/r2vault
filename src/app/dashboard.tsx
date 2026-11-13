"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import StorageHeader, { type StorageStatus } from "./components/storage-header";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type StoredFile = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
};

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

export default function Dashboard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("checking");

  const loadFiles = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/objects?view=recent", {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setStorageStatus("error");
        throw new Error("Lista fajlova trenutno nije dostupna.");
      }
      const data = (await response.json()) as { files: StoredFile[] };
      setFiles(data.files);
      setStorageStatus("connected");
    } catch (error) {
      setStorageStatus("error");
      setLoadError(
        error instanceof Error
          ? error.message
          : "Lista fajlova trenutno nije dostupna.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  function addFiles(fileList: FileList | File[]) {
    const selected = Array.from(fileList);
    if (selected.length === 0) return;

    const next: UploadItem[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: file.size > MAX_FILE_SIZE ? "error" : "queued",
      error:
        file.size > MAX_FILE_SIZE
          ? "Fajl je veći od dozvoljenih 100 MB."
          : undefined,
    }));
    setUploads((current) => [...next, ...current].slice(0, 20));
    setNotice("");
    void uploadQueue(next.filter((item) => item.status === "queued"));
  }

  async function uploadQueue(queue: UploadItem[]) {
    if (queue.length === 0) return;
    let completed = 0;

    for (const item of queue) {
      setUploads((current) =>
        current.map((upload) =>
          upload.id === item.id
            ? { ...upload, status: "uploading", progress: 0 }
            : upload,
        ),
      );

      try {
        const response = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.file.name,
            size: item.file.size,
            type: item.file.type || "application/octet-stream",
          }),
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const result = (await response.json()) as {
          url?: string;
          contentType?: string;
          error?: string;
        };
        if (!response.ok || !result.url || !result.contentType) {
          throw new Error(result.error ?? "Nije moguće pripremiti upload.");
        }

        await uploadToStorage(
          result.url,
          item.file,
          result.contentType,
          (progress) => {
            setUploads((current) =>
              current.map((upload) =>
                upload.id === item.id ? { ...upload, progress } : upload,
              ),
            );
          },
        );
        setUploads((current) =>
          current.map((upload) =>
            upload.id === item.id
              ? { ...upload, status: "done", progress: 100 }
              : upload,
          ),
        );
        completed += 1;
      } catch (error) {
        setUploads((current) =>
          current.map((upload) =>
            upload.id === item.id
              ? {
                  ...upload,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Upload nije uspeo.",
                }
              : upload,
          ),
        );
      }
    }

    if (completed > 0) {
      setNotice(
        completed === 1
          ? "Fajl je uspešno sačuvan u R2."
          : `${completed} fajla su uspešno sačuvana u R2.`,
      );
      await loadFiles();
    }
  }

  function uploadToStorage(
    url: string,
    file: File,
    contentType: string,
    onProgress: (progress: number) => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(
            new Error("Upload nije uspeo. Proveri CORS podešavanja za R2."),
          );
        }
      };
      xhr.onerror = () =>
        reject(
          new Error(
            "Mrežna greška pri uploadu. Proveri CORS podešavanja za R2.",
          ),
        );
      xhr.onabort = () => reject(new Error("Upload je prekinut."));
      xhr.send(file);
    });
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  async function downloadFile(key: string) {
    try {
      const response = await fetch(
        `/api/download?key=${encodeURIComponent(key)}`,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Preuzimanje nije uspelo.");
      window.location.assign(result.url);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Preuzimanje nije uspelo.",
      );
    }
  }

  async function copyFileLink(key: string, purpose: "copy" | "permanent") {
    try {
      const response = await fetch(
        `/api/download?key=${encodeURIComponent(key)}&purpose=${purpose}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Link nije moguće napraviti.");
      await navigator.clipboard.writeText(result.url);
      setCopyNotice(
        purpose === "permanent"
          ? "Stalni javni link je kopiran. Svako ko ga ima može preuzeti fajl dok god je dostupan."
          : "Privremeni link je kopiran. Važi 15 minuta i svako ko ga ima može preuzeti fajl.",
      );
      window.setTimeout(() => setCopyNotice(""), 7000);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Link nije moguće kopirati.",
      );
    }
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  return (
    <main className="dashboard-shell">
      <StorageHeader currentPage="home" storageStatus={storageStatus} />

      <section className="dashboard-content">
        <div className="welcome-row">
          <div>
            <span className="eyebrow">CLOUDFLARE R2 · PRIVATNI BUCKET</span>
            <h1>
              Tvoj storage, <span>na jednom mestu.</span>
            </h1>
            <p>Otpremi fajlove sigurno i upravljaj svojim objektima.</p>
          </div>
          <div className="welcome-badge">
            <ShieldIcon /> Privatna sesija
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon stat-icon-violet">
              <FilesIcon />
            </span>
            <div>
              <span className="stat-label">FAJLOVA U PREGLEDU</span>
              <strong>{isLoading ? "—" : files.length}</strong>
            </div>
            <span className="stat-caption">U listi brzog pristupa</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon stat-icon-blue">
              <DatabaseIcon />
            </span>
            <div>
              <span className="stat-label">VELIČINA PRIKAZA</span>
              <strong>{isLoading ? "—" : formatBytes(totalBytes)}</strong>
            </div>
            <span className="stat-caption">Zbir vidljivih objekata</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon stat-icon-green">
              <CloudIcon />
            </span>
            <div>
              <span className="stat-label">STORAGE STATUS</span>
              <strong
                className={`stat-online${storageStatus === "error" ? " stat-error" : ""}`}
              >
                {storageStatus === "connected"
                  ? "Povezan"
                  : storageStatus === "checking"
                    ? "Provera..."
                    : "Nedostupan"}
              </strong>
            </div>
            <span className="stat-caption">Cloudflare R2</span>
          </article>
        </div>

        <div className="workspace-grid">
          <section className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <h2>Otpremi fajlove</h2>
                <p>Prevuci fajlove ili izaberi sa uređaja.</p>
              </div>
              <span className="panel-step">
                01 <span>/ 02</span>
              </span>
            </div>
            <div
              className={`drop-zone${isDragging ? " drop-zone-active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setIsDragging(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                accept="*/*"
                className="visually-hidden"
                multiple
                onChange={onFileInput}
                type="file"
              />
              <span className="upload-icon">
                <UploadIcon />
              </span>
              <h3>Prevuci fajlove ovde</h3>
              <p>
                ili{" "}
                <button
                  className="inline-button"
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  izaberi fajlove
                </button>{" "}
                sa svog uređaja
              </p>
              <span className="file-limit">
                Do 100 MB po fajlu <span>·</span> Svi formati
              </span>
            </div>

            {uploads.length > 0 && (
              <div className="upload-queue">
                <div className="queue-heading">
                  <span>Upload red</span>
                  <span>
                    {uploads.length} fajl{uploads.length === 1 ? "" : "a"}
                  </span>
                </div>
                {uploads.slice(0, 5).map((upload) => (
                  <div className="upload-item" key={upload.id}>
                    <span className="file-icon">
                      <FileIcon />
                    </span>
                    <div className="upload-item-info">
                      <div className="upload-item-title">
                        <span title={upload.file.name}>{upload.file.name}</span>
                        <small>
                          {upload.status === "done"
                            ? "Sačuvan"
                            : upload.status === "error"
                              ? "Greška"
                              : `${formatBytes(upload.file.size)}${upload.status === "uploading" ? ` · ${upload.progress}%` : ""}`}
                        </small>
                      </div>
                      {upload.status === "uploading" && (
                        <div className="progress-track">
                          <span style={{ width: `${upload.progress}%` }} />
                        </div>
                      )}
                      {upload.status === "error" && (
                        <span className="upload-error">{upload.error}</span>
                      )}
                    </div>
                    <span
                      className={`upload-status upload-status-${upload.status}`}
                    >
                      {upload.status === "done" ? (
                        <CheckIcon />
                      ) : upload.status === "error" ? (
                        <ErrorIcon />
                      ) : upload.status === "uploading" ? (
                        <span className="mini-spinner" />
                      ) : (
                        <span className="queue-dot" />
                      )}
                    </span>
                  </div>
                ))}
                {uploads.length > 5 && (
                  <span className="more-uploads">
                    i još {uploads.length - 5} fajlova
                  </span>
                )}
              </div>
            )}

            {notice && (
              <p className="success-message" role="status">
                <CheckIcon /> {notice}
              </p>
            )}
            <div className="upload-footnote">
              <LockIcon />
              <span>
                Fajlovi se šalju direktno u R2 putem privremenog, potpisanog
                URL-a.
              </span>
            </div>
          </section>

          <section className="panel files-panel">
            <div className="panel-heading files-heading">
              <div>
                <h2>Brzi pristup</h2>
                <p>Pet najnovijih fajlova iz storage-a.</p>
              </div>
              <Link className="view-all-button" href="/files">
                Svi fajlovi <ArrowIcon />
              </Link>
            </div>

            {loadError && (
              <p className="load-error" role="alert">
                {loadError}
              </p>
            )}
            {copyNotice && (
              <p className="copy-notice" role="status">
                {copyNotice}
              </p>
            )}
            {isLoading ? (
              <div className="empty-state">
                <span className="mini-spinner" />
                <p>Učitavanje fajlova...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <FolderIcon />
                </span>
                <strong>Još nema fajlova</strong>
                <p>Otpremi prvi fajl da bi se pojavio ovde.</p>
              </div>
            ) : (
              <div className="file-list">
                {files.map((file) => (
                  <article className="stored-file" key={file.key}>
                    <span className="file-icon file-icon-stored">
                      <FileIcon />
                    </span>
                    <div className="stored-file-info">
                      <strong title={file.name}>{file.name}</strong>
                      <span>
                        {formatBytes(file.size)} <i>·</i>{" "}
                        {file.lastModified
                          ? formatDate(file.lastModified)
                          : "—"}
                      </span>
                    </div>
                    <div className="file-actions">
                      <button
                        aria-label={`Kopiraj stalni javni link za ${file.name}`}
                        className="link-copy-button"
                        onClick={() => void copyFileLink(file.key, "permanent")}
                        title="Stalni, javno dostupan link"
                        type="button"
                      >
                        Stalni
                      </button>
                      <button
                        aria-label={`Kopiraj privremeni link za ${file.name} koji važi 15 minuta`}
                        className="link-copy-button"
                        onClick={() => void copyFileLink(file.key, "copy")}
                        title="Privremeni link koji važi 15 minuta"
                        type="button"
                      >
                        15 min
                      </button>
                      <button
                        aria-label={`Preuzmi ${file.name}`}
                        className="download-button"
                        onClick={() => void downloadFile(file.key)}
                        type="button"
                      >
                        <DownloadIcon />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="files-footer">
              <span>
                <span className="status-dot" /> Zaštićeno prijavom
              </span>
              <Link href="/files">
                Otvori sve fajlove <ArrowIcon />
              </Link>
            </div>
          </section>
        </div>
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

function CloudIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M7.5 18.5h10a4 4 0 0 0 .4-8 6.5 6.5 0 0 0-12.4 1.8 3.2 3.2 0 0 0 2 6.2Z" />
      <path d="m9.5 13.5 2.5-2.5 2.5 2.5M12 11v6" />
    </svg>
  );
}
function FilesIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" />
      <path d="M13 3v7h7M8 14h8m-8 4h8" />
    </svg>
  );
}
function DatabaseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M10 2.5 16 5v4.7c0 3.7-2.6 6.3-6 7.8-3.4-1.5-6-4.1-6-7.8V5l6-2.5Z" />
      <path d="m7.5 9.8 1.7 1.7 3.4-3.6" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 28 28">
      <path d="M14 18V5m0 0L9 10m5-5 5 5" />
      <path d="M6 17v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
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
function ErrorIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5v4m0 3h.01" />
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
function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <path d="M3.5 9h11m-4.5-4.5L14.5 9 10 13.5" />
    </svg>
  );
}
