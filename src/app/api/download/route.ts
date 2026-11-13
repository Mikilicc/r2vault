import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { getBucketName, getR2Client, sanitizeFileName } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Prijavi se da bi nastavio." }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key");
  const purpose = new URL(request.url).searchParams.get("purpose") ?? "download";
  if (
    !key ||
    key.length > 1024 ||
    key.split("/").some((part) => part === "." || part === "..") ||
    (purpose !== "download" && purpose !== "copy")
  ) {
    return NextResponse.json({ error: "Nevažeći fajl." }, { status: 400 });
  }

  const fileName = sanitizeFileName(key.split("/").pop() ?? "fajl").replace(/^[0-9a-f-]{36}-/, "");

  try {
    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });
    const url = await getSignedUrl(getR2Client(), command, { expiresIn: purpose === "copy" ? 15 * 60 : 60 });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not create an R2 download URL:", error);
    return NextResponse.json({ error: "Nije moguće preuzeti fajl iz R2." }, { status: 502 });
  }
}
