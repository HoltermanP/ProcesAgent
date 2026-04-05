import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { BUILD_DIRS } from "@/lib/build-store";

export async function GET(request: NextRequest) {
  const buildId = request.nextUrl.searchParams.get("buildId");

  if (!buildId) {
    return NextResponse.json({ error: "buildId required" }, { status: 400 });
  }

  const buildDir = BUILD_DIRS.get(buildId);
  if (!buildDir || !existsSync(buildDir)) {
    return NextResponse.json(
      { error: "Build niet gevonden. Voer de build opnieuw uit." },
      { status: 404 }
    );
  }

  // Create a zip of the build directory
  const zipPath = join(tmpdir(), `procesagents-${buildId}.zip`);

  try {
    execSync(
      `cd "${buildDir}" && zip -r "${zipPath}" . --exclude "*/node_modules/*" --exclude "*/.next/*" --exclude "*/.git/*"`,
      { encoding: "utf-8" }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "ZIP aanmaken mislukt: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }

  let zipBuffer: Buffer;
  try {
    zipBuffer = readFileSync(zipPath);
  } catch {
    return NextResponse.json({ error: "ZIP bestand niet leesbaar" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="procesagents-${buildId}.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
