import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextRequest, NextResponse } from "next/server";

import { readRelationshipCache } from "@/lib/cache";
import { loadCandidatePool, resolvePair } from "@/lib/candidatePool";
import type { AiExplanationResponse, AiStatus, TurningPoint } from "@/lib/types";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

interface AiExplanationRequestBody {
  pairId?: unknown;
  turningPointDate?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse<AiExplanationResponse>> {
  const body = (await request.json().catch(() => ({}))) as AiExplanationRequestBody;
  const requestedPair = typeof body.pairId === "string" ? body.pairId : null;
  const turningPointDate = typeof body.turningPointDate === "string" ? body.turningPointDate : null;
  if (!requestedPair || !turningPointDate || !/^\d{4}-\d{2}-\d{2}$/.test(turningPointDate)) {
    return NextResponse.json(
      { status: "error", message: "pairId and turningPointDate are required.", turningPoint: null },
      { status: 400 }
    );
  }

  const pool = loadCandidatePool();
  const resolution = resolvePair(pool, requestedPair);
  if (!resolution.isValid) {
    return NextResponse.json(
      { status: "error", message: "pairId is not in the legal candidate pair list.", turningPoint: null },
      { status: 400 }
    );
  }

  const cacheBefore = await readRelationshipCache(resolution.pairId).catch(() => ({ payload: null }));
  const currentTurningPoint = findTurningPoint(cacheBefore.payload?.turning_points ?? [], turningPointDate);
  if (currentTurningPoint === null) {
    return NextResponse.json(
      { status: "error", message: "Turning point not found in relationship cache.", turningPoint: null },
      { status: 404 }
    );
  }

  try {
    await runPythonEnrichment(resolution.pairId, turningPointDate);
  } catch (caught) {
    return NextResponse.json({
      status: "error",
      message: caught instanceof Error ? caught.message : "AI generation failed.",
      turningPoint: currentTurningPoint
    });
  }

  const cacheAfter = await readRelationshipCache(resolution.pairId).catch(() => ({ payload: null }));
  const updatedTurningPoint = findTurningPoint(cacheAfter.payload?.turning_points ?? [], turningPointDate);
  const status = (updatedTurningPoint?.ai_status ?? "error") as AiStatus | "error";
  const message = status === "ready" ? null : aiStatusMessage(status);
  return NextResponse.json({ status, message, turningPoint: updatedTurningPoint ?? currentTurningPoint });
}

function findTurningPoint(points: TurningPoint[], turningPointDate: string): TurningPoint | null {
  return points.find((point) => point.date === turningPointDate) ?? null;
}

async function runPythonEnrichment(pairId: string, turningPointDate: string): Promise<void> {
  const pythonBin = process.env.PYTHON_BIN || path.join(process.cwd(), ".venv", "bin", "python");
  await execFileAsync(
    pythonBin,
    ["-m", "relationship_temperature.enrichment", "--pair", pairId, "--turning-point-date", turningPointDate],
    {
      cwd: process.cwd(),
      env: process.env,
      timeout: 60_000,
      maxBuffer: 1024 * 1024
    }
  );
}

function aiStatusMessage(status: AiStatus | "error"): string | null {
  if (status === "missing_key") {
    return "DeepSeek API key is not configured.";
  }
  if (status === "error") {
    return "AI explanation generation failed.";
  }
  return null;
}
