import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

export async function GET(request: NextRequest) {
  const buildId = request.nextUrl.searchParams.get("buildId");

  if (!buildId || !/^[a-f0-9]+$/.test(buildId)) {
    return NextResponse.json({ error: "buildId required" }, { status: 400 });
  }

  // Reconstruct the build directory path from the buildId — no in-memory Map needed
  const buildDir = join(tmpdir(), `procesagents-${buildId}`);
  if (!existsSync(buildDir)) {
    return NextResponse.json(
      { error: "Build niet gevonden. De tijdelijke bestanden zijn verwijderd — voer de build opnieuw uit." },
      { status: 404 }
    );
  }

  // Create a zip of the build directory (always fresh — delete old zip if present)
  const zipPath = join(tmpdir(), `procesagents-${buildId}.zip`);
  if (existsSync(zipPath)) {
    try { rmSync(zipPath); } catch { /* ignore */ }
  }

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
