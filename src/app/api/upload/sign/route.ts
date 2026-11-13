import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasValidSession, isSameOrigin } from "@/lib/auth";
import { getBucketName, getR2Client, sanitizeFileName } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_URL_AGE_SECONDS = 5 * 60;

export async function POST(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Prijavi se da bi nastavio." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Nevažeći zahtev." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nevažeći zahtev." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    !("size" in body) ||
    !("type" in body) ||
    typeof body.name !== "string" ||
    typeof body.size !== "number" ||
    typeof body.type !== "string" ||
    body.name.length < 1 ||
    body.name.length > 255 ||
    !Number.isSafeInteger(body.size) ||
    body.size < 0 ||
    body.size > MAX_FILE_SIZE ||
    body.type.length > 150
  ) {
    return NextResponse.json({ error: "Fajl nije ispravan ili prelazi ograničenje od 100 MB." }, { status: 400 });
  }

  const contentType = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(body.type)
    ? body.type
    : "application/octet-stream";
  const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitizeFileName(body.name)}`;

  try {
    const command = new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ContentType: contentType,
      ContentLength: body.size,
    });
    const url = await getSignedUrl(getR2Client(), command, {
      expiresIn: MAX_URL_AGE_SECONDS,
      signableHeaders: new Set(["content-type"]),
    });
    return NextResponse.json(
      { url, key, contentType },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not create an R2 upload URL:", error);
    return NextResponse.json({ error: "R2 trenutno nije dostupan. Proveri konfiguraciju storage-a." }, { status: 502 });
  }
}
