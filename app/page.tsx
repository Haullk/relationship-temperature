"use client";

import Image from "next/image";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";

import { chartPath, chartPoints, type ChartPoint } from "@/lib/chart";
import type {
  AiExplanationResponse,
  FeaturedCardPayload,
  FeaturedTrendPoint,
  FeaturedPair,
  RelationshipPayload,
  TrendApiResponse,
  TurningPoint
} from "@/lib/types";

const indexBlue = "#4A7FA5";
const indexGray = "#6B7280";
const indexRed = "#C4563B";

type ChartRangeDays = 90 | 30 | 15;
const chartRanges: ChartRangeDays[] = [90, 30, 15];
const currentAiPromptVersion = "report-cn-v4";
const objectFlags: Record<string, string> = {
  chn: "🇨🇳",
  usa: "🇺🇸",
  rus: "🇷🇺",
  europe: "🇪🇺",
  jpn: "🇯🇵",
  ind: "🇮🇳",
  irn: "🇮🇷",
  twn: "🇹🇼",
  ukr: "🇺🇦"
};

export default function Page() {
  return <TrendApp />;
}

function indexVisualBand(value: number | null | undefined): "band-cold" | "band-neutral" | "band-hot" {
  if (value === null || value === undefined) {
    return "band-neutral";
  }
  if (value >= 70) {
    return "band-hot";
  }
  if (value < 50) {
    return "band-cold";
  }
  return "band-neutral";
}

function indexVisualColor(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return indexGray;
  }
  if (value >= 70) {
    return indexRed;
  }
  if (value < 50) {
    return indexBlue;
  }
  return indexGray;
}

function relationshipStatusLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "等待数据";
  }
  if (value >= 70) {
    return "明显偏友好";
  }
  if (value >= 55) {
    return "偏友好";
  }
  if (value > 45) {
    return "接近中性";
  }
  if (value >= 35) {
    return "偏紧张";
  }
  return "明显偏紧张";
}

function TrendApp() {
  const [data, setData] = useState<TrendApiResponse | null>(null);
  const [selectedPair, setSelectedPair] = useState("chn_usa");
  const [draftObjectA, setDraftObjectA] = useState("chn");
  const [draftObjectB, setDraftObjectB] = useState("usa");
  const [selectedTurningDate, setSelectedTurningDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [chartRangeDays, setChartRangeDays] = useState<ChartRangeDays>(90);
  const [methodOpen, setMethodOpen] = useState(true);
  const [contentUpdated, setContentUpdated] = useState(false);
  const [aiPendingKeys, setAiPendingKeys] = useState<Set<string>>(() => new Set());
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [headerActionsOpen, setHeaderActionsOpen] = useState(false);
  const [wechatOpen, setWechatOpen] = useState(false);
  const explanationRef = useRef<HTMLElement | null>(null);
  const wechatCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareResetTimer = useRef<number | null>(null);
  const contentUpdateTimer = useRef<number | null>(null);
  const draftAutoLoadTimer = useRef<number | null>(null);
  const hasLoadedOnce = useRef(false);
  const requestedAiKeys = useRef<Set<string>>(new Set());

  const markAiPending = useCallback((requestKey: string, pending: boolean) => {
    setAiPendingKeys((previous) => {
      const next = new Set(previous);
      if (pending) {
        next.add(requestKey);
      } else {
        next.delete(requestKey);
      }
      return next;
    });
  }, []);

  const requestAiForTurningPoint = useCallback(async (
    pairId: string,
    turningPointDate: string,
    options: { showMessage?: boolean; force?: boolean } = {}
  ) => {
    const requestKey = aiRequestKey(pairId, turningPointDate);
    if (!options.force && requestedAiKeys.current.has(requestKey)) {
      return;
    }
    requestedAiKeys.current.add(requestKey);
    markAiPending(requestKey, true);
    if (options.showMessage ?? true) {
      setAiMessage(null);
    }
    try {
      const response = await requestAiExplanation(pairId, turningPointDate, { force: options.force === true });
      const updatedTurningPoint = response.turningPoint;
      if (updatedTurningPoint) {
        setData((previous) => replaceTurningPoint(previous, pairId, updatedTurningPoint));
      }
      if (options.showMessage ?? true) {
        setAiMessage(response.message);
      }
    } catch (caught: unknown) {
      requestedAiKeys.current.delete(requestKey);
      if (options.showMessage ?? true) {
        setAiMessage(caught instanceof Error ? caught.message : "解读生成失败，已保留规则版解释。");
      }
    } finally {
      markAiPending(requestKey, false);
    }
  }, [markAiPending]);

  const warmRelationshipAi = useCallback((nextRelationship: RelationshipPayload | null) => {
    if (nextRelationship === null) {
      return;
    }
    const latestPendingPoint = [...nextRelationship.turning_points].reverse().find(needsAiRefresh);
    if (!latestPendingPoint) {
      return;
    }
    void requestAiForTurningPoint(nextRelationship.pair_id, latestPendingPoint.date, { showMessage: false });
  }, [requestAiForTurningPoint]);

  const loadPair = useCallback(async (pair: string, options: { warmAi?: boolean } = {}) => {
    if (draftAutoLoadTimer.current !== null) {
      window.clearTimeout(draftAutoLoadTimer.current);
      draftAutoLoadTimer.current = null;
    }
    setSelectedPair(pair);
    setLoading(true);
    setSlow(false);
    setError(null);
    setSelectedTurningDate(null);
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    try {
      const response = await fetch(`/api/trend?pair=${encodeURIComponent(pair)}`);
      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }
      const payload = (await response.json()) as TrendApiResponse;
      setData(payload);
      setSelectedPair(payload.pairId);
      const [nextObjectA = "chn", nextObjectB = "usa"] = payload.pairId.split("_");
      setDraftObjectA(nextObjectA);
      setDraftObjectB(nextObjectB);
      const nextTurningPoints = payload.relationship?.turning_points ?? [];
      setSelectedTurningDate(nextTurningPoints[nextTurningPoints.length - 1]?.date ?? null);
      const url = new URL(window.location.href);
      url.searchParams.set("pair", payload.pairId);
      window.history.replaceState({}, "", url);
      if (hasLoadedOnce.current) {
        if (contentUpdateTimer.current !== null) {
          window.clearTimeout(contentUpdateTimer.current);
        }
        setContentUpdated(true);
        contentUpdateTimer.current = window.setTimeout(() => setContentUpdated(false), 900);
      }
      hasLoadedOnce.current = true;
      if (options.warmAi) {
        warmRelationshipAi(payload.relationship);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "unknown error");
    } finally {
      window.clearTimeout(slowTimer);
      setLoading(false);
    }
  }, [warmRelationshipAi]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    void loadPair(params.get("pair") ?? "chn_usa");
  }, [loadPair]);

  useEffect(() => () => {
    if (draftAutoLoadTimer.current !== null) {
      window.clearTimeout(draftAutoLoadTimer.current);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");
    const syncMethodState = () => setMethodOpen(!mediaQuery.matches);
    syncMethodState();
    mediaQuery.addEventListener("change", syncMethodState);
    return () => mediaQuery.removeEventListener("change", syncMethodState);
  }, []);

  const selectedTurning = useMemo(() => {
    if (selectedTurningDate === null) {
      return null;
    }
    const points = data?.relationship?.turning_points ?? [];
    return points.find((point) => point.date === selectedTurningDate) ?? null;
  }, [data, selectedTurningDate]);

  const candidates = useMemo(() => data?.candidatePool.objects ?? [], [data?.candidatePool.objects]);
  const featuredPairs = data?.candidatePool.featuredPairs ?? [];
  const legalPairIds = useMemo(() => new Set(data?.candidatePool.legalPairIds ?? []), [data]);
  const candidateLabels = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate.label])),
    [candidates]
  );
  const relationship = data?.relationship ?? null;
  const hasNoData = data?.cacheStatus === "missing" || relationship?.turning_point_status === "no_data";
  const initialLoading = loading && data === null;
  const panelLoading = loading && data !== null;

  useEffect(() => {
    if (relationship === null) {
      return;
    }
    const visibleTrend = visibleTrendForRange(relationship.trend, chartRangeDays);
    const visibleDates = new Set(visibleTrend.map((point) => point.date));
    const visibleSegments = relationship.turning_points.filter(
      (point) => visibleDates.has(point.previous_date) && visibleDates.has(point.date)
    );
    setSelectedTurningDate((previousDate) => {
      if (visibleSegments.some((point) => point.date === previousDate)) {
        return previousDate;
      }
      return visibleSegments[visibleSegments.length - 1]?.date ?? null;
    });
  }, [relationship, chartRangeDays]);

  useEffect(() => {
    if (relationship === null || selectedTurning === null) {
      return;
    }
    if (!needsAiRefresh(selectedTurning)) {
      return;
    }
    setAiMessage(null);
    void requestAiForTurningPoint(relationship.pair_id, selectedTurning.date);
  }, [relationship, requestAiForTurningPoint, selectedTurning]);

  useEffect(() => {
    setAiMessage(null);
  }, [relationship?.pair_id, selectedTurning?.date]);

  useEffect(() => {
    if (!wechatOpen) {
      return;
    }

    window.setTimeout(() => wechatCloseButtonRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setWechatOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [wechatOpen]);

  function queueDraftPairAnalysis(leftObject: string, rightObject: string) {
    if (!isLegalPair(leftObject, rightObject, legalPairIds)) {
      return;
    }
    const pair = canonicalPairId(leftObject, rightObject);
    if (pair === selectedPair) {
      return;
    }
    if (draftAutoLoadTimer.current !== null) {
      window.clearTimeout(draftAutoLoadTimer.current);
    }
    draftAutoLoadTimer.current = window.setTimeout(() => {
      draftAutoLoadTimer.current = null;
      void loadPair(pair, { warmAi: true });
    }, 220);
  }

  function updateDraftObjectA(nextObject: string) {
    setDraftObjectA(nextObject);
    queueDraftPairAnalysis(nextObject, draftObjectB);
  }

  function updateDraftObjectB(nextObject: string) {
    setDraftObjectB(nextObject);
    queueDraftPairAnalysis(draftObjectA, nextObject);
  }

  async function shareCurrentUrl() {
    const copied = await copyTextToClipboard(window.location.href);
    setShareStatus(copied ? "copied" : "failed");
    if (shareResetTimer.current !== null) {
      window.clearTimeout(shareResetTimer.current);
    }
    shareResetTimer.current = window.setTimeout(() => setShareStatus("idle"), 1600);
  }

  function scrollToExplanation() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    explanationRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function selectTurningPoint(date: string) {
    setSelectedTurningDate(date);
    if (window.matchMedia("(max-width: 820px)").matches) {
      window.setTimeout(scrollToExplanation, 0);
    }
  }

  return (
    <main className="page-shell">
      <header className={`topbar${headerActionsOpen ? " is-open" : ""}`}>
        <div className="brand-area">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" focusable="false">
              <circle className="brand-circle warm" cx="25" cy="32" r="17" />
              <circle className="brand-circle cool" cx="39" cy="32" r="17" />
            </svg>
          </span>
          <div className="brand-copy">
            <h1>GeoPrizm</h1>
            <p className="topbar-subtitle">
              <strong>双边关系看板</strong>：基于全球新闻信号，追踪主要国家双边关系动态
            </p>
            <div className="signal-row" aria-label="产品信号">
              <span className="signal">
                <span className="signal-dot" aria-hidden="true" />
                GDELT / CAMEO 新闻信号
              </span>
              <span className="signal">
                <span className="signal-dot warm" aria-hidden="true" />
                中文 AI 趋势解读
              </span>
            </div>
          </div>

          <button
            className="icon-button mobile-toggle"
            type="button"
            aria-expanded={headerActionsOpen}
            aria-controls="header-actions"
            aria-label={headerActionsOpen ? "收起联系入口" : "展开联系入口"}
            onClick={() => setHeaderActionsOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="header-actions" id="header-actions">
          <div className="action-stack" aria-label="项目链接">
            <a
              className="header-link primary"
              href="https://github.com/Haullk/relationship-temperature"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 .5C5.65.5.85 5.38.85 11.75c0 4.98 3.23 9.2 7.72 10.69.56.1.77-.24.77-.54v-2.02c-3.14.68-3.8-1.35-3.8-1.35-.51-1.31-1.25-1.66-1.25-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.39-1.23.71-1.51-2.51-.28-5.15-1.25-5.15-5.57 0-1.23.44-2.24 1.17-3.03-.12-.29-.51-1.44.11-2.99 0 0 .96-.31 3.13 1.16.91-.25 1.88-.38 2.85-.38s1.94.13 2.85.38c2.17-1.47 3.13-1.16 3.13-1.16.62 1.55.23 2.7.11 2.99.73.79 1.17 1.8 1.17 3.03 0 4.33-2.65 5.28-5.17 5.56.41.35.77 1.04.77 2.11v3.13c0 .3.2.65.78.54a11.27 11.27 0 0 0 7.71-10.69C23.15 5.38 18.35.5 12 .5Z"
                />
              </svg>
              GitHub 项目
            </a>
            <a className="header-link" href="mailto:helioshulk@gmail.com">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4.75 6.75h14.5v10.5H4.75V6.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                <path
                  d="m5.25 7.25 6.74 5.35 6.76-5.35"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              邮箱联系
            </a>
            <button className="header-link" type="button" onClick={() => setWechatOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9.75 15.75c-3.04 0-5.5-1.92-5.5-4.3s2.46-4.3 5.5-4.3 5.5 1.92 5.5 4.3-2.46 4.3-5.5 4.3Z"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
                <path
                  d="M14.25 10.15c2.8.25 4.95 1.98 4.95 4.08 0 1.21-.7 2.29-1.82 3.04l.44 1.73-1.9-.93c-.55.15-1.12.23-1.72.23-2.19 0-4.08-.98-4.9-2.39"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
                <path d="M7.75 10.85h.01M11.75 10.85h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
              </svg>
              微信公众号
            </button>
          </div>

          <aside className="status-card" aria-label="项目状态摘要">
            <span className="live-dot" aria-hidden="true" />
            <span>最新数据：</span>
            {relationship?.data_end ? <time dateTime={relationship.data_end}>{relationship.data_end}</time> : <span>等待缓存数据</span>}
          </aside>
        </div>
      </header>

      {wechatOpen ? (
        <div
          className="wechat-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechat-modal-title"
          aria-describedby="wechat-modal-description"
          onClick={() => setWechatOpen(false)}
        >
          <section className="wechat-modal-card" onClick={(event) => event.stopPropagation()}>
            <button
              ref={wechatCloseButtonRef}
              className="wechat-close"
              type="button"
              aria-label="关闭微信公众号二维码"
              onClick={() => setWechatOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
            <div>
              <h2 id="wechat-modal-title">微信公众号</h2>
              <p id="wechat-modal-description">扫码关注项目更新</p>
            </div>
            <Image className="wechat-qr" src="/wechat-qr.jpg" alt="微信公众号二维码" width={430} height={430} />
          </section>
        </div>
      ) : null}

      {initialLoading ? <Skeleton /> : null}
      {slow ? <Notice tone="warn" text="数据加载较慢，请稍后或重试。" /> : null}
      {error ? <Notice tone="error" text={`API 加载失败：${error}`} action={() => void loadPair(selectedPair)} /> : null}
      {!loading && data?.message ? <Notice tone="warn" text={data.message} /> : null}
      {!loading && data?.cacheStatus === "stale" ? <Notice tone="warn" text="数据可能不是最新。" /> : null}

      <section className="featured-strip" aria-label="重点关系">
        {featuredPairs.map((pair) => (
          <RelationshipCard
            key={pair.pairId}
            pair={pair}
            payload={data?.featuredCards.find((card) => card.pair_id === pair.pairId) ?? null}
            active={pair.pairId === selectedPair}
            candidateLabels={candidateLabels}
            onClick={() => void loadPair(pair.pairId, { warmAi: true })}
          />
        ))}
      </section>

      {!loading && candidates.length < 2 ? <Notice tone="error" text="候选对象配置不足，暂时无法选择关系组合。" /> : null}
      {!loading && hasNoData ? <Notice tone="warn" text="当前组合暂无足够事件数据。" /> : null}
      {!loading && relationship?.turning_point_status === "data_insufficient" ? <Notice tone="warn" text="数据积累不足，趋势仅供参考。" /> : null}
      {!loading && relationship?.turning_point_status === "no_significant_turning_points" ? (
        <Notice tone="info" text="近 90 天未检测到明显趋势段。" />
      ) : null}

      <section className={`workspace ${contentUpdated ? "content-updated" : ""}`}>
        <RelationshipChart
          relationship={relationship}
          selectedTurningDate={selectedTurningDate}
          onSelectTurning={selectTurningPoint}
          rangeDays={chartRangeDays}
          onRangeChange={setChartRangeDays}
          candidates={candidates}
          legalPairIds={legalPairIds}
          draftObjectA={draftObjectA}
          draftObjectB={draftObjectB}
          onDraftObjectAChange={updateDraftObjectA}
          onDraftObjectBChange={updateDraftObjectB}
          shareStatus={shareStatus}
          onShare={() => void shareCurrentUrl()}
          onShowExplanation={scrollToExplanation}
          loading={panelLoading}
        />
        <ExplanationPanel
          ref={explanationRef}
          relationship={relationship}
          turningPoint={selectedTurning}
          hasSelectedTurning={selectedTurningDate !== null}
          aiPending={selectedTurning ? aiPendingKeys.has(aiRequestKey(relationship?.pair_id ?? "", selectedTurning.date)) : false}
          aiMessage={aiMessage}
          onRequestAi={
            relationship && selectedTurning
              ? () => void requestAiForTurningPoint(relationship.pair_id, selectedTurning.date, { force: true })
              : null
          }
          loading={panelLoading}
        />
      </section>

      <details
        className="method-box"
        open={methodOpen}
        onToggle={(event) => setMethodOpen(event.currentTarget.open)}
      >
        <summary>数据来源与方法说明</summary>
        <p className="method-lead">关系指数基于全球新闻报道计算，反映媒体对两国关系的信号——不代表官方外交立场。</p>
        <div className="method-grid">
          <section>
            <h3>指数是怎么来的</h3>
            <p>
              每天从全球新闻数据库中抓取涉及两国的报道，识别其中的合作或冲突信号，按报道热度加权后映射为 0—100 的指数。
              50 为中性，高于 50 偏友好，低于 50 偏紧张。用 14 天滚动平均展示，以平滑单日波动。
            </p>
          </section>
          <section>
            <h3>AI 做了什么</h3>
            <p>
              AI 根据新闻标题和摘要，自动生成关系变化的中文解读，帮你快速理解指数背后发生了什么。
              它只负责总结，不判断事件的确切因果，也不读取新闻全文。
            </p>
          </section>
          <section>
            <h3>使用前须知</h3>
            <p>
              指数反映的是“媒体在重点报道什么”，不等于两国关系的实际状态。重大事件密集报道时，指数可能出现短期大幅波动。
              数据方法参考{" "}
              <a href="https://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf" target="_blank" rel="noreferrer">
                GDELT 2.0
              </a>
              {" "}与{" "}
              <a href="https://parusanalytics.com/eventdata/data.dir/cameo.html" target="_blank" rel="noreferrer">
                CAMEO 事件编码框架
              </a>
              。
            </p>
          </section>
        </div>
      </details>
    </main>
  );
}

function RelationshipCard({
  pair,
  payload,
  active,
  candidateLabels,
  onClick
}: {
  pair: FeaturedPair;
  payload: FeaturedCardPayload | null;
  active: boolean;
  candidateLabels: Map<string, string>;
  onClick: () => void;
}) {
  const visualBand = indexVisualBand(payload?.current_temperature);
  const yesterdayDelta = dailyDelta(payload);
  const temperature = payload?.current_temperature?.toFixed(1) ?? "--";
  const statusLabel = relationshipStatusLabel(payload?.current_temperature);
  const pairName = pair.objects
    .map((objectId) => candidateLabels.get(objectId) ?? objectId.toUpperCase())
    .join(" / ");
  return (
    <button
      type="button"
      className={`relation-card ${visualBand} ${active ? "active" : ""}`}
      onClick={onClick}
      aria-label={`${pairName}，指数 ${temperature}，${statusLabel}，${yesterdayDelta.label}，查看分析`}
      aria-pressed={active}
    >
      <span className="card-top-row">
        <span className="card-country-pair">
          {pair.objects.map((objectId, index) => (
            <span key={objectId} className="card-country">
              <span className="flag-icon">{objectFlags[objectId] ?? ""}</span>
              <span className="card-country-label">{candidateLabels.get(objectId) ?? objectId.toUpperCase()}</span>
              {index === 0 ? <span className="card-country-separator">/</span> : null}
            </span>
          ))}
        </span>
        <span className="card-index">
          <span>指数</span>
          <strong>{temperature}</strong>
          <span className={`card-delta-badge ${yesterdayDelta.kind}`}>{yesterdayDelta.label.replace("较昨日 ", "")}</span>
        </span>
      </span>
      <span className="card-sparkline-wrap">
        <MiniSparkline trend={payload?.trend ?? []} />
      </span>
      <span className="card-status-row">
        <span>{statusLabel}</span>
        <span className="card-action">查看</span>
      </span>
    </button>
  );
}

function MiniSparkline({ trend }: { trend: readonly FeaturedTrendPoint[] }) {
  const points = sparklinePoints(trend, 150, 44, 3);
  const latestPoint = points[points.length - 1];
  return (
    <svg className="sparkline" viewBox="0 0 150 44" role="img" aria-label="迷你趋势线">
      <path d={chartPath(points)} fill="none" stroke="currentColor" strokeWidth="2.4" />
      {latestPoint ? <circle cx={latestPoint.x} cy={latestPoint.y} r="3.2" className="sparkline-end-dot" /> : null}
    </svg>
  );
}

function RelationshipChart({
  relationship,
  selectedTurningDate,
  onSelectTurning,
  rangeDays,
  onRangeChange,
  candidates,
  legalPairIds,
  draftObjectA,
  draftObjectB,
  onDraftObjectAChange,
  onDraftObjectBChange,
  shareStatus,
  onShare,
  onShowExplanation,
  loading
}: {
  relationship: RelationshipPayload | null;
  selectedTurningDate: string | null;
  onSelectTurning: (date: string) => void;
  rangeDays: ChartRangeDays;
  onRangeChange: (rangeDays: ChartRangeDays) => void;
  candidates: TrendApiResponse["candidatePool"]["objects"];
  legalPairIds: Set<string>;
  draftObjectA: string;
  draftObjectB: string;
  onDraftObjectAChange: (objectId: string) => void;
  onDraftObjectBChange: (objectId: string) => void;
  shareStatus: "idle" | "copied" | "failed";
  onShare: () => void;
  onShowExplanation: () => void;
  loading: boolean;
}) {
  const width = 880;
  const height = 400;
  const padding = 64;
  const visibleTrend = visibleTrendForRange(relationship?.trend ?? [], rangeDays);
  const points = chartPoints(visibleTrend, width, height, padding);
  const path = chartPath(points);
  const areaPath = chartAreaPath(points, height, padding);
  const latestPoint = points[points.length - 1];
  const visibleDates = useMemo(() => new Set(visibleTrend.map((point) => point.date)), [visibleTrend]);
  const turningPoints = (relationship?.turning_points ?? []).filter(
    (point) => visibleDates.has(point.previous_date) && visibleDates.has(point.date)
  );
  const xTicks = buildDateTicks(visibleTrend);
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [rangeFading, setRangeFading] = useState(false);
  const chartCandidateLabels = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate.label])),
    [candidates]
  );
  const relationshipObjects = relationship ? [relationship.object_a, relationship.object_b] : [];
  const relationshipTitle = relationshipObjects.length > 0
    ? relationshipObjects.map((objectId) => chartCandidateLabels.get(objectId) ?? objectId.toUpperCase()).join(" / ")
    : "暂无数据";
  const chartAccent = indexVisualColor(relationship?.current_temperature);
  const chartStyle = { "--chart-accent": chartAccent } as CSSProperties;
  const currentDelta = dailyDelta(relationship);
  const scoreValue = relationship?.current_temperature?.toFixed(1) ?? "--";
  const scoreDateLabel = relationship?.data_end ? `${relationship.data_end}日指数` : "等待数据";
  const statusLabel = relationshipStatusLabel(relationship?.current_temperature);
  const sideLabels = [
    { tick: 100, label: "友好" },
    { tick: 50, label: "中性" },
    { tick: 0, label: "对立" }
  ];
  const showAllSegmentLabels = turningPoints.length <= 3;
  const selectedTurningPoint = selectedTurningDate
    ? turningPoints.find((point) => point.date === selectedTurningDate) ?? null
    : null;

  useEffect(() => {
    setRangeFading(true);
    const timer = window.setTimeout(() => setRangeFading(false), 150);
    return () => window.clearTimeout(timer);
  }, [rangeDays]);

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "mouse" || points.length === 0) {
      setHoveredPoint(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const viewBoxX = ((event.clientX - rect.left) / rect.width) * width;
    const nearest = points.reduce((closest, point) =>
      Math.abs(point.x - viewBoxX) < Math.abs(closest.x - viewBoxX) ? point : closest
    );
    setHoveredPoint(nearest);
  }

  function handlePointerLeave() {
    setHoveredPoint(null);
  }

  return (
    <section className={`chart-panel ${loading ? "panel-busy" : ""}`} style={chartStyle} aria-label="关系指数趋势图">
      <div className="panel-heading chart-heading">
        <div className="chart-heading-row chart-heading-primary">
          <div className="chart-selector-row" aria-label="国家对选择器">
            <select
              value={draftObjectA}
              disabled={candidates.length < 2}
              onChange={(event) => onDraftObjectAChange(event.target.value)}
            >
              {candidates.map((candidate) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                  disabled={!isLegalPair(candidate.id, draftObjectB, legalPairIds)}
                >
                  {objectFlags[candidate.id] ? `${objectFlags[candidate.id]} ` : ""}{candidate.label}
                </option>
              ))}
            </select>
            <span className="chart-pair-divider" aria-hidden="true">—</span>
            <select
              value={draftObjectB}
              disabled={candidates.length < 2}
              onChange={(event) => onDraftObjectBChange(event.target.value)}
            >
              {candidates.map((candidate) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                  disabled={!isLegalPair(draftObjectA, candidate.id, legalPairIds)}
                >
                  {objectFlags[candidate.id] ? `${objectFlags[candidate.id]} ` : ""}{candidate.label}
                </option>
              ))}
            </select>
          </div>
          <div className="range-control chart-range-control" aria-label="图表范围">
            {chartRanges.map((days) => (
              <button
                key={days}
                type="button"
                className={rangeDays === days ? "active" : ""}
                onClick={() => onRangeChange(days)}
              >
                {days}日
              </button>
            ))}
          </div>
        </div>
        <div className="chart-heading-row chart-heading-secondary">
          <div className="chart-title-block">
            <h2>{relationshipTitle}</h2>
            <p className="chart-context">
              {relationshipObjects.length > 0 ? `${statusLabel} · 关系指数趋势` : "等待缓存数据"}
            </p>
          </div>
          <div className="score-inline" aria-label={scoreDateLabel}>
            <span className="score-date">{scoreDateLabel}</span>
            <strong>{scoreValue}</strong>
            <span className={`score-delta ${currentDelta.kind}`}>{currentDelta.label.replace("较昨日 ", "")}</span>
          </div>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`chart ${rangeFading ? "range-fading" : ""}`}
        style={chartStyle}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <linearGradient id="trendAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#374151" stopOpacity="0.13" />
            <stop offset="62%" stopColor="#374151" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#374151" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} className="chart-surface" />
        <rect
          x={padding}
          y={padding}
          width={width - padding * 2}
          height={height - padding * 2}
          className="chart-hitbox"
        />
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = temperatureToY(tick, height, padding);
          return (
            <g key={tick}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} className={`grid-line score-line score-line-${tick}`} />
              <text x={padding - 10} y={y + 4} className={`axis-label score-label score-label-${tick}`} textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        {sideLabels.map((label) => (
          <text
            key={label.tick}
            x={width - padding + 7}
            y={temperatureToY(label.tick, height, padding) + 4}
            className={`axis-side-label axis-side-label-${label.tick}`}
            textAnchor="start"
          >
            {label.label}
          </text>
        ))}
        <g className="chart-svg-legend" role="img" aria-label="图表颜色说明" transform={`translate(${width / 2 - 238}, 20)`}>
          <line x1="0" x2="16" y1="0" y2="0" className="chart-svg-legend-line improve" />
          <text x="24" y="4">红色：改善或偏友好</text>
          <line x1="190" x2="206" y1="0" y2="0" className="chart-svg-legend-line neutral" />
          <text x="214" y="4">50：中性线</text>
          <line x1="318" x2="334" y1="0" y2="0" className="chart-svg-legend-line worsen" />
          <text x="342" y="4">蓝色：恶化或偏紧张</text>
        </g>
        {areaPath ? <path d={areaPath} className="trend-area" /> : null}
        <path d={path} className="trend-line history" />
        <path d={path} className="trend-line current" />
        {turningPoints.map((point) => {
          const segment = segmentPoints(points, point.previous_date, point.date);
          const startPoint = segment[0];
          const endPoint = segment[segment.length - 1];
          if (!startPoint || !endPoint) {
            return null;
          }
          const selected = selectedTurningDate === point.date;
          const directionClass = point.direction === "改善" ? "improve" : "worsen";
          const showSegmentLabel = selected || showAllSegmentLabels;
          const labelAnchor = segment[Math.floor(segment.length / 2)] ?? endPoint;
          const labelY = Math.max(padding + 16, labelAnchor.y - 28);
          return (
            <g
              key={point.date}
              role="button"
              tabIndex={0}
              className={`trend-segment-group ${selected ? "selected" : ""}`}
              aria-label={`${point.previous_date} 至 ${point.date}，${point.direction} ${formatDelta(point.delta)}`}
              aria-pressed={selected}
              onClick={() => onSelectTurning(point.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectTurning(point.date);
                }
              }}
            >
              <title>{`${point.previous_date} 至 ${point.date} · ${point.direction} ${formatDelta(point.delta)}`}</title>
              <path d={chartPath(segment)} className="trend-segment-hit" />
              {selected ? <path d={chartPath(segment)} className={`trend-segment-glow ${directionClass}`} /> : null}
              <path d={chartPath(segment)} className={`trend-segment-highlight ${directionClass}`} />
              <circle cx={startPoint.x} cy={startPoint.y} r="4" className={`segment-start ${directionClass}`} />
              <circle
                cx={endPoint.x}
                cy={endPoint.y}
                r={selected ? 9 : 7}
                className={`segment-end ${directionClass}`}
              />
              {showSegmentLabel ? (
                <line
                  x1={labelAnchor.x}
                  x2={labelAnchor.x}
                  y1={labelAnchor.y - 4}
                  y2={labelY + 8}
                  className={`segment-value-line ${directionClass}`}
                />
              ) : null}
              {showSegmentLabel ? (
                <text
                  x={labelAnchor.x}
                  y={labelY}
                  className={`segment-label ${directionClass} ${selected ? "selected" : ""}`}
                  textAnchor="middle"
                >
                  {formatDelta(point.delta)}
                </text>
              ) : null}
            </g>
          );
        })}
        {latestPoint ? <circle cx={latestPoint.x} cy={latestPoint.y} r="5.5" className="chart-current-dot" /> : null}
        {xTicks.map((tick) => {
          const chartPoint = points.find((point) => point.date === tick);
          if (!chartPoint) {
            return null;
          }
          return (
            <text key={tick} x={chartPoint.x} y={height - 12} className="axis-label x-axis-label" textAnchor="middle">
              {shortDate(tick)}
            </text>
          );
        })}
        {hoveredPoint ? <HoverGuide point={hoveredPoint} width={width} height={height} padding={padding} /> : null}
      </svg>
      <div className="chart-footer">
        <div className="chart-guide">
          <p className="chart-reading-note">点高亮段查看解释，指数反映媒体报道信号。</p>
        </div>
        <button type="button" className="share-button" onClick={onShare}>
          {shareStatus === "copied" ? "已复制" : shareStatus === "failed" ? "复制失败" : "分享"}
        </button>
      </div>
      {selectedTurningPoint ? (
        <button
          type="button"
          className="mobile-explanation-cta"
          onClick={onShowExplanation}
          aria-controls="explanation-panel"
        >
          <span className="mobile-explanation-meta">
            <span>当前趋势段</span>
            <strong>{`${selectedTurningPoint.direction} ${formatDelta(selectedTurningPoint.delta)}`}</strong>
            <span>{compactDateRange(selectedTurningPoint.previous_date, selectedTurningPoint.date)}</span>
          </span>
          <span className="mobile-explanation-action">查看解释</span>
        </button>
      ) : null}
      {loading ? <PanelLoading /> : null}
    </section>
  );
}

function HoverGuide({
  point,
  width,
  height,
  padding
}: {
  point: ChartPoint;
  width: number;
  height: number;
  padding: number;
}) {
  const tooltipWidth = 132;
  const tooltipHeight = 44;
  const tooltipX = point.x > width - padding - tooltipWidth ? point.x - tooltipWidth - 10 : point.x + 10;
  const tooltipY = point.y < padding + tooltipHeight ? point.y + 14 : point.y - tooltipHeight - 12;
  return (
    <g className="hover-guide">
      <line x1={point.x} x2={point.x} y1={padding} y2={height - padding} />
      <circle cx={point.x} cy={point.y} r="5" />
      <g transform={`translate(${tooltipX}, ${tooltipY})`} className="hover-tooltip">
        <rect width={tooltipWidth} height={tooltipHeight} rx="6" />
        <text x="10" y="18">{point.date}</text>
        <text x="10" y="34">{`指数 ${point.temperature.toFixed(1)}`}</text>
      </g>
    </g>
  );
}

function canonicalPairId(left: string, right: string): string {
  return [left, right].sort().join("_");
}

function isLegalPair(left: string, right: string, legalPairIds: Set<string>): boolean {
  return left !== right && legalPairIds.has(canonicalPairId(left, right));
}

const ExplanationPanel = forwardRef<HTMLElement, {
  relationship: RelationshipPayload | null;
  turningPoint: TurningPoint | null;
  hasSelectedTurning: boolean;
  aiPending: boolean;
  aiMessage: string | null;
  onRequestAi: (() => void) | null;
  loading: boolean;
}>(function ExplanationPanel({ relationship, turningPoint, hasSelectedTurning, aiPending, aiMessage, onRequestAi, loading }, ref) {
  const [activeTab, setActiveTab] = useState<"analysis" | "reports">("analysis");

  useEffect(() => {
    setActiveTab("analysis");
  }, [relationship?.pair_id, turningPoint?.date]);

  if (relationship === null || relationship.turning_point_status === "no_data") {
    return (
      <section id="explanation-panel" ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
        <h2>趋势段解释</h2>
        <p className="muted">当前组合暂无足够事件数据。</p>
        {loading ? <PanelLoading /> : null}
      </section>
    );
  }
  if (turningPoint === null) {
    return (
      <section id="explanation-panel" ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
        <h2>趋势段解释</h2>
        <p className="muted">
          {relationship.turning_points.length > 0 && !hasSelectedTurning
            ? "点击趋势线上的高亮线段查看趋势解释。"
            : "近 90 天未检测到明显趋势段。"}
        </p>
        {loading ? <PanelLoading /> : null}
      </section>
    );
  }
  const hasAiSummary = turningPoint.ai_status === "ready" && Boolean(turningPoint.ai_summary);
  const summary = relationshipIndexCopy(cleanRelativeTimePrefix(hasAiSummary ? turningPoint.ai_summary : turningPoint.summary));
  const visibleEvidence = (turningPoint.ai_evidence ?? []).map(relationshipIndexCopy);
  const mainEvent = relationshipIndexCopy(turningPoint.ai_main_event);
  const aiNotice = aiStatusNotice(turningPoint, { hasAiSummary, aiPending, aiMessage });
  const canRequestAi = !hasAiSummary && !aiPending && turningPoint.ai_status !== "missing_key" && onRequestAi !== null;
  const directionClass = turningPoint.direction === "改善" ? "improve" : "worsen";
  const directionTitle = turningPoint.direction === "改善" ? "关系改善" : "关系恶化";
  return (
    <section id="explanation-panel" ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
      <div className="explain-heading">
        <div className="explain-heading-main">
          <div className="explain-heading-copy">
            <h2>{directionTitle}</h2>
            <p className="eyebrow">{compactDateRange(turningPoint.previous_date, turningPoint.date)}</p>
          </div>
          <strong className={`explain-delta ${directionClass}`}>{formatDelta(turningPoint.delta)}</strong>
        </div>
      </div>

      {hasAiSummary && mainEvent ? (
        <div className="ai-main-event">
          <span className="ai-main-event-label">主线</span>
          <strong>{mainEvent}</strong>
        </div>
      ) : null}

      <div className="explain-tabs" role="tablist" aria-label="解释器内容">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "analysis"}
          className={activeTab === "analysis" ? "active" : ""}
          onClick={() => setActiveTab("analysis")}
        >
          趋势解读
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reports"}
          className={activeTab === "reports" ? "active" : ""}
          onClick={() => setActiveTab("reports")}
        >
          <span>相关报道</span>
          <span className="tab-count">{turningPoint.reports.length}</span>
        </button>
      </div>

      {activeTab === "analysis" ? (
        <div className="explain-tab-panel analysis-tab" role="tabpanel">
          <p className="explain-summary">{summary}</p>
          {aiPending ? <p className="ai-status">解读生成中，当前先显示规则版解释。</p> : null}
          {aiNotice ? (
            <div className={`ai-status-row ${aiNotice.tone}`}>
              <p className="ai-status">{aiNotice.text}</p>
              {canRequestAi ? (
                <button type="button" className="ai-status-action" onClick={() => onRequestAi?.()}>
                  {turningPoint.ai_status === "error" ? "重试" : "生成"}
                </button>
              ) : null}
            </div>
          ) : null}
          {hasAiSummary && visibleEvidence.length ? (
            <div className="evidence-block">
              <h3>证据线索</h3>
              <ul className="ai-evidence-list" aria-label="证据线索">
                {visibleEvidence.map((evidence) => {
                  const parsedEvidence = splitEvidenceLine(evidence);
                  return (
                    <li key={evidence}>
                      {parsedEvidence.date ? <time dateTime={parsedEvidence.date}>{parsedEvidence.date}</time> : null}
                      {parsedEvidence.date ? " " : null}
                      <strong>{parsedEvidence.text}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="driver-list">
            {turningPoint.drivers.map((driver) => (
              <span key={`${driver.event_root_code}-${driver.label}`}>{driver.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="explain-tab-panel reports-tab" role="tabpanel">
          <div className="reports">
            {uniqueReports(turningPoint.reports).map((report) => (
              <a key={report.source_url} href={report.source_url} target="_blank" rel="noreferrer">
                <strong>{reportTitle(report)}</strong>
                {reportSummary(report) ? <span className="report-summary">{reportSummary(report)}</span> : null}
                <small className="report-meta">
                  <span>{cleanDomain(report.source_domain)} · {report.event_type}</span>
                  <time dateTime={report.date}>{report.date}</time>
                </small>
              </a>
            ))}
          </div>
        </div>
      )}
      {loading ? <PanelLoading /> : null}
    </section>
  );
});

function PanelLoading() {
  return (
    <div className="panel-loading" role="status" aria-live="polite">
      加载中...
    </div>
  );
}

function Notice({ tone, text, action }: { tone: "info" | "warn" | "error"; text: string; action?: () => void }) {
  return (
    <div className={`notice ${tone}`}>
      <span>{text}</span>
      {action ? (
        <button type="button" onClick={action}>
          重试
        </button>
      ) : null}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton-grid" aria-label="加载中">
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}

function dailyDelta(payload: { trend: readonly FeaturedTrendPoint[] } | null): { label: string; kind: "up" | "down" | "flat" } {
  const trend = payload?.trend ?? [];
  if (trend.length < 2) {
    return { label: "较昨日 --", kind: "flat" };
  }
  const latest = trend[trend.length - 1].relationship_temperature;
  const previous = trend[trend.length - 2].relationship_temperature;
  const delta = latest - previous;
  if (Math.abs(delta) < 0.05) {
    return { label: "较昨日 持平", kind: "flat" };
  }
  return {
    label: `较昨日 ${delta > 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(1)}`,
    kind: delta > 0 ? "up" : "down"
  };
}

function temperatureToY(temperature: number, height: number, padding: number): number {
  const plotHeight = height - padding * 2;
  return padding + ((100 - temperature) / 100) * plotHeight;
}

function segmentPoints(points: ChartPoint[], startDate: string, endDate: string): ChartPoint[] {
  const startIndex = points.findIndex((point) => point.date === startDate);
  const endIndex = points.findIndex((point) => point.date === endDate);
  if (startIndex < 0 || endIndex < startIndex) {
    return [];
  }
  return points.slice(startIndex, endIndex + 1);
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

function chartAreaPath(points: ChartPoint[], height: number, padding: number): string {
  if (points.length === 0) {
    return "";
  }
  const baselineY = height - padding;
  const line = chartPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `M ${first.x.toFixed(1)} ${baselineY.toFixed(1)} ${line.replace(/^M/, "L")} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

function visibleTrendForRange(trend: RelationshipPayload["trend"], rangeDays: ChartRangeDays) {
  return trend.slice(-rangeDays);
}

function sparklinePoints(
  trend: readonly FeaturedTrendPoint[],
  width: number,
  height: number,
  padding: number
) {
  if (trend.length === 0) {
    return [];
  }
  const temperatures = trend.map((point) => point.relationship_temperature);
  const minTemperature = Math.min(...temperatures);
  const maxTemperature = Math.max(...temperatures);
  const center = (minTemperature + maxTemperature) / 2;
  const domainRange = Math.max((maxTemperature - minTemperature) * 1.1, 8);
  const domainMin = center - domainRange / 2;
  const domainMax = center + domainRange / 2;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const denominator = Math.max(trend.length - 1, 1);

  return trend.map((point, index) => ({
    x: padding + (index / denominator) * plotWidth,
    y: padding + ((domainMax - point.relationship_temperature) / (domainMax - domainMin)) * plotHeight,
    date: point.date,
    temperature: point.relationship_temperature
  }));
}

function buildDateTicks(trend: RelationshipPayload["trend"]): string[] {
  if (trend.length === 0) {
    return [];
  }
  const lastIndex = trend.length - 1;
  const indexes = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(lastIndex * ratio));
  return [...new Set(indexes.map((index) => trend[index].date))];
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${month}-${day}`;
}

function compactDateRange(startDate: string, endDate: string): string {
  const [startYear] = startDate.split("-");
  const [endYear, endMonth, endDay] = endDate.split("-");
  if (startYear === endYear && endMonth && endDay) {
    return `${startDate} 至 ${endMonth}-${endDay}`;
  }
  return `${startDate} 至 ${endDate}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

async function requestAiExplanation(
  pairId: string,
  turningPointDate: string,
  options: { force?: boolean } = {}
): Promise<AiExplanationResponse> {
  const response = await fetch("/api/ai/explanation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairId, turningPointDate, force: options.force === true })
  });
  const payload = (await response.json()) as AiExplanationResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? `AI API ${response.status}`);
  }
  return payload;
}

function replaceTurningPoint(
  previous: TrendApiResponse | null,
  pairId: string,
  turningPoint: TurningPoint
): TrendApiResponse | null {
  if (previous?.relationship?.pair_id !== pairId) {
    return previous;
  }
  return {
    ...previous,
    relationship: {
      ...previous.relationship,
      turning_points: previous.relationship.turning_points.map((point) =>
        point.date === turningPoint.date ? turningPoint : point
      )
    }
  };
}

function reportTitle(report: TurningPoint["reports"][number]): string {
  const candidates = [report.chinese_title, report.resolved_title, report.url_title]
    .map(cleanReportText)
    .filter((title): title is string => title !== null && isReadableReportTitle(title, report.source_domain));
  return candidates[0] ?? `${cleanDomain(report.source_domain)} 相关报道`;
}

function reportSummary(report: TurningPoint["reports"][number]): string | null {
  const candidates = [report.chinese_summary, report.short_summary, report.meta_description]
    .map(cleanReportText)
    .filter((summary): summary is string => summary !== null && isReadableReportSummary(summary));
  return candidates[0] ? relationshipIndexCopy(candidates[0]) : null;
}

function uniqueReports(reports: TurningPoint["reports"]): TurningPoint["reports"] {
  const seen = new Set<string>();
  const unique: TurningPoint["reports"] = [];
  for (const report of reports) {
    const title = reportTitle(report).replace(/（重复）$/, "").trim().toLowerCase();
    const key = `${cleanDomain(report.source_domain).toLowerCase()}|${title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(report);
  }
  return unique;
}

function aiRequestKey(pairId: string, turningPointDate: string): string {
  return `${currentAiPromptVersion}:${pairId}:${turningPointDate}`;
}

function needsAiRefresh(turningPoint: TurningPoint): boolean {
  const aiStatus = turningPoint.ai_status ?? "not_requested";
  if (aiStatus === "error" || aiStatus === "missing_key") {
    return false;
  }
  return aiStatus !== "ready" || turningPoint.ai_prompt_version !== currentAiPromptVersion;
}

function aiStatusNotice(
  turningPoint: TurningPoint,
  state: { hasAiSummary: boolean; aiPending: boolean; aiMessage: string | null }
): { text: string; tone: "muted" | "warn" } | null {
  if (state.hasAiSummary || state.aiPending) {
    return null;
  }
  if (state.aiMessage) {
    return { text: state.aiMessage, tone: "warn" };
  }
  const aiStatus = turningPoint.ai_status ?? "not_requested";
  if (aiStatus === "missing_key") {
    return { text: "AI 服务暂未配置，当前先显示规则版解释。", tone: "warn" };
  }
  if (aiStatus === "error") {
    return { text: "AI 解读生成失败，当前先显示规则版解释。", tone: "warn" };
  }
  if (aiStatus === "not_requested" || aiStatus === "pending") {
    return { text: "AI 解读尚未生成，当前先显示规则版解释。", tone: "muted" };
  }
  return null;
}

function cleanReportText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\s+[|｜-]\s+(The Express Tribune|NBC Chicago|Moneycontrol\\.com)$/i, "")
    .trim();
  return cleaned || null;
}

function isReadableReportTitle(title: string, sourceDomain: string): boolean {
  const lowered = title.toLowerCase();
  const domain = cleanDomain(sourceDomain).toLowerCase();
  if (
    lowered === "just a moment..." ||
    lowered === "just a moment" ||
    lowered === "403 forbidden" ||
    lowered === "404 not found" ||
    lowered === "file not found" ||
    lowered.includes("请稍候") ||
    lowered.includes("相关报道线索") ||
    lowered.includes("报道标题缺失")
  ) {
    return false;
  }
  if (domain && (lowered === domain || lowered === `www.${domain}`)) {
    return false;
  }
  if (/^article[\s_-]+[0-9a-f-]{12,}$/i.test(title)) {
    return false;
  }
  if (/^[0-9a-f]{8}[- ][0-9a-f]{4}[- ][0-9a-f]{4}/i.test(title)) {
    return false;
  }
  return title.length >= 4;
}

function isReadableReportSummary(summary: string): boolean {
  const lowered = summary.toLowerCase();
  return !(
    lowered.includes("提供了一条") && lowered.includes("相关报道线索") ||
    lowered.includes("点击可查看原始报道") ||
    lowered.includes("报道标题缺失") ||
    lowered.includes("具体内容无法获取")
  );
}

function cleanDomain(sourceDomain: string): string {
  return sourceDomain.replace(/^www\./, "").replace(/:443$/, "") || "来源网站";
}

function cleanRelativeTimePrefix(value: string | null | undefined): string {
  return (value ?? "").replace(/^(近期|近来|近日|最近)[，,、\s]*/, "");
}

function relationshipIndexCopy(value: string | null | undefined): string {
  return (value ?? "").replace(/关系温度/g, "关系指数").replace(/温度/g, "指数");
}

function splitEvidenceLine(value: string): { date: string | null; text: string } {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[：:，,\s-]*(.+)$/);
  if (!match) {
    return { date: null, text: value };
  }
  return { date: match[1] ?? null, text: match[2]?.trim() ?? value };
}
