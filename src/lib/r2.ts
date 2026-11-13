import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

export function getBucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured.");
  return bucket;
}

export function getR2Client() {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 credentials are not fully configured.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return client;
}

export function sanitizeFileName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[\\/]/g, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120) || "fajl";
}
