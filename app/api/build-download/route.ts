import { NextRequest, NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { BUILD_DIRS } from "@/lib/build-store";

// Recursively collect all files in a directory
function collectFiles(dir: string, base: string): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];
  const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build"]);

  function walk(current: string) {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP.has(entry)) continue;
      const full = join(current, entry);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        walk(full);
      } else {
        try {
          const content = readFileSync(full, "utf-8");
          results.push({ path: relative(base, full), content });
        } catch {
          // skip binary files
        }
      }
    }
  }
  walk(dir);
  return results;
}

// Build a simple ZIP as a multi-file JSON for the client to reconstruct
export async function GET(request: NextRequest) {
  const buildId = request.nextUrl.searchParams.get("buildId");

  if (!buildId) {
    return NextResponse.json({ error: "buildId required" }, { status: 400 });
  }

  const buildDir = BUILD_DIRS.get(buildId);
  if (!buildDir) {
    return NextResponse.json(
      { error: "Build niet gevonden. Voer de build opnieuw uit." },
      { status: 404 }
    );
  }

  const files = collectFiles(buildDir, buildDir);

  if (files.length === 0) {
    return NextResponse.json({ error: "Geen bestanden gevonden in build directory" }, { status: 404 });
  }

  return NextResponse.json({ files, buildDir });
}
