import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextRequest, NextResponse } from "next/server";

import { readRelationshipCache } from "@/lib/cache";
import { loadCandidatePool, resolvePair } from "@/lib/candidatePool";
import type { AiExplanationResponse, AiStatus, TurningPoint } from "@/lib/types";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const enrichmentTimeoutMs = 120_000;

interface AiExplanationRequestBody {
  pairId?: unknown;
  turningPointDate?: unknown;
  force?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse<AiExplanationResponse>> {
  const body = (await request.json().catch(() => ({}))) as AiExplanationRequestBody;
  const requestedPair = typeof body.pairId === "string" ? body.pairId : null;
  const turningPointDate = typeof body.turningPointDate === "string" ? body.turningPointDate : null;
  const forceRefresh = body.force === true;
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

  let enrichmentResult: PythonEnrichmentResult = {};
  try {
    enrichmentResult = await runPythonEnrichment(resolution.pairId, turningPointDate, { force: forceRefresh });
  } catch (caught) {
    return NextResponse.json({
      status: "error",
      message: aiRuntimeErrorMessage(caught),
      turningPoint: withAiStatus(currentTurningPoint, "error")
    });
  }

  const cacheAfter = await readRelationshipCache(resolution.pairId).catch(() => ({ payload: null }));
  const updatedTurningPoint = findTurningPoint(cacheAfter.payload?.turning_points ?? [], turningPointDate);
  const status = resolveAiStatus(updatedTurningPoint, enrichmentResult);
  const message = status === "ready" ? null : aiStatusMessage(status);
  return NextResponse.json({
    status,
    message,
    turningPoint: updatedTurningPoint ?? withAiStatus(currentTurningPoint, status)
  });
}

function findTurningPoint(points: TurningPoint[], turningPointDate: string): TurningPoint | null {
  return points.find((point) => point.date === turningPointDate) ?? null;
}

interface PythonEnrichmentResult {
  ai_status?: AiStatus | "error";
  message?: string | null;
}

async function runPythonEnrichment(
  pairId: string,
  turningPointDate: string,
  options: { force: boolean }
): Promise<PythonEnrichmentResult> {
  const pythonBin = process.env.PYTHON_BIN || path.join(process.cwd(), ".venv", "bin", "python");
  const args = ["-m", "relationship_temperature.enrichment", "--pair", pairId, "--turning-point-date", turningPointDate];
  if (options.force) {
    args.push("--force");
  }
  const { stdout } = await execFileAsync(
    pythonBin,
    args,
    {
      cwd: process.cwd(),
      env: process.env,
      timeout: enrichmentTimeoutMs,
      maxBuffer: 1024 * 1024
    }
  );
  return parsePythonEnrichmentResult(stdout);
}

function parsePythonEnrichmentResult(stdout: string): PythonEnrichmentResult {
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) {
    return {};
  }
  try {
    const parsed = JSON.parse(line) as { ai_status?: unknown; message?: unknown };
    return {
      ai_status: isAiStatus(parsed.ai_status) ? parsed.ai_status : undefined,
      message: typeof parsed.message === "string" ? parsed.message : null
    };
  } catch {
    return {};
  }
}

function resolveAiStatus(
  turningPoint: TurningPoint | null,
  enrichmentResult: PythonEnrichmentResult
): AiStatus | "error" {
  if (turningPoint?.ai_status) {
    return turningPoint.ai_status;
  }
  if (enrichmentResult.ai_status) {
    return enrichmentResult.ai_status;
  }
  return "error";
}

function withAiStatus(turningPoint: TurningPoint, status: AiStatus | "error"): TurningPoint {
  return { ...turningPoint, ai_status: status };
}

function isAiStatus(status: unknown): status is AiStatus | "error" {
  return ["not_requested", "pending", "ready", "error", "missing_key"].includes(String(status));
}

function aiRuntimeErrorMessage(caught: unknown): string {
  if (caught instanceof Error && /timeout|timed out/i.test(caught.message)) {
    return "AI 解读生成超时，当前先显示规则版解释。";
  }
  return "AI 解读生成失败，当前先显示规则版解释。";
}

function aiStatusMessage(status: AiStatus | "error"): string | null {
  if (status === "missing_key") {
    return "AI 服务暂未配置，当前先显示规则版解释。";
  }
  if (status === "error") {
    return "AI 解读生成失败，当前先显示规则版解释。";
  }
  if (status === "not_requested" || status === "pending") {
    return "AI 解读尚未生成，当前先显示规则版解释。";
  }
  return null;
}
