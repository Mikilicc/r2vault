import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { getBucketName, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Prijavi se da bi nastavio." }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const view = searchParams.get("view") ?? "all";
  const continuationToken = searchParams.get("cursor");
  if (
    (view !== "all" && view !== "recent") ||
    (continuationToken && (view === "recent" || continuationToken.length > 4096))
  ) {
    return NextResponse.json({ error: "Nevažeći zahtev." }, { status: 400 });
  }

  try {
    const result = await getR2Client().send(new ListObjectsV2Command({
      Bucket: getBucketName(),
      MaxKeys: view === "recent" ? 1000 : 100,
      ContinuationToken: continuationToken ?? undefined,
    }));
    const files = (result.Contents ?? [])
      .flatMap((object) => {
        const key = object.Key;
        if (!key) return [];
        const name = key.split("/").pop() ?? key;
        return [{
          key,
          name: name.replace(/^[0-9a-f-]{36}-/, ""),
          size: object.Size ?? 0,
          lastModified: object.LastModified?.toISOString() ?? null,
        }];
      })
      .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));
    const pageFiles = view === "recent" ? files.slice(0, 5) : files;

    return NextResponse.json(
      {
        files: pageFiles,
        nextToken: view === "recent" ? null : result.NextContinuationToken ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not list R2 objects:", error);
    return NextResponse.json({ error: "Nije moguće učitati fajlove iz R2. Proveri podešavanja bucket-a." }, { status: 502 });
  }
}
