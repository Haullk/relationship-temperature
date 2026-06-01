"use client";

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
import type { FeaturedPair, RelationshipPayload, TemperatureBand, TrendApiResponse, TurningPoint } from "@/lib/types";

const bandClass: Record<string, string> = {
  明显偏冲突: "band-red",
  偏冲突: "band-orange",
  接近中性: "band-gray",
  偏合作: "band-blue",
  明显偏合作: "band-green"
};

const bandColor: Record<TemperatureBand, string> = {
  明显偏冲突: "#c4403a",
  偏冲突: "#d06c2f",
  接近中性: "#68727d",
  偏合作: "#2d6cdf",
  明显偏合作: "#2f8f5b"
};

type ChartRangeDays = 90 | 30 | 15;
const chartRanges: ChartRangeDays[] = [90, 30, 15];
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
  const explanationRef = useRef<HTMLElement | null>(null);
  const shareResetTimer = useRef<number | null>(null);

  const loadPair = useCallback(async (pair: string) => {
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
      setSelectedTurningDate(payload.relationship?.turning_points[0]?.date ?? null);
      const url = new URL(window.location.href);
      url.searchParams.set("pair", payload.pairId);
      window.history.replaceState({}, "", url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "unknown error");
    } finally {
      window.clearTimeout(slowTimer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    void loadPair(params.get("pair") ?? "chn_usa");
  }, [loadPair]);

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
  const draftPairIsLegal = isLegalPair(draftObjectA, draftObjectB, legalPairIds);
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
      return visibleSegments[0]?.date ?? null;
    });
  }, [relationship, chartRangeDays]);

  function analyzeDraftPair() {
    if (!draftPairIsLegal) {
      return;
    }
    const pair = canonicalPairId(draftObjectA, draftObjectB);
    void loadPair(pair);
  }

  async function shareCurrentUrl() {
    const copied = await copyTextToClipboard(window.location.href);
    setShareStatus(copied ? "copied" : "failed");
    if (shareResetTimer.current !== null) {
      window.clearTimeout(shareResetTimer.current);
    }
    shareResetTimer.current = window.setTimeout(() => setShareStatus("idle"), 1600);
  }

  function selectTurningPoint(date: string) {
    setSelectedTurningDate(date);
    if (window.matchMedia("(max-width: 820px)").matches) {
      window.setTimeout(() => explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">关系温度计</p>
          <h1>双边关系趋势</h1>
        </div>
        <div className="updated">
          {relationship?.data_start && relationship.data_end
            ? `${relationship.data_start} 至 ${relationship.data_end}`
            : "等待缓存数据"}
        </div>
      </header>

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
            onClick={() => void loadPair(pair.pairId)}
          />
        ))}
      </section>

      <section className="controls-row" aria-label="国家对选择器">
        <select
          value={draftObjectA}
          disabled={candidates.length < 2}
          onChange={(event) => setDraftObjectA(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option
              key={candidate.id}
              value={candidate.id}
              disabled={!isLegalPair(candidate.id, draftObjectB, legalPairIds)}
            >
              {candidate.label}
            </option>
          ))}
        </select>
        <select
          value={draftObjectB}
          disabled={candidates.length < 2}
          onChange={(event) => setDraftObjectB(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option
              key={candidate.id}
              value={candidate.id}
              disabled={!isLegalPair(draftObjectA, candidate.id, legalPairIds)}
            >
              {candidate.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="analysis-button"
          disabled={!draftPairIsLegal || loading}
          onClick={analyzeDraftPair}
        >
          分析
        </button>
      </section>

      {!loading && candidates.length < 2 ? <Notice tone="error" text="候选对象配置不足，暂时无法选择关系组合。" /> : null}
      {!loading && hasNoData ? <Notice tone="warn" text="当前组合暂无足够事件数据。" /> : null}
      {!loading && relationship?.turning_point_status === "data_insufficient" ? <Notice tone="warn" text="数据积累不足，趋势仅供参考。" /> : null}
      {!loading && relationship?.turning_point_status === "no_significant_turning_points" ? (
        <Notice tone="info" text="近 90 天未检测到明显趋势段。" />
      ) : null}

      <section className="workspace">
        <RelationshipChart
          relationship={relationship}
          selectedTurningDate={selectedTurningDate}
          onSelectTurning={selectTurningPoint}
          rangeDays={chartRangeDays}
          onRangeChange={setChartRangeDays}
          candidateLabels={candidateLabels}
          shareStatus={shareStatus}
          onShare={() => void shareCurrentUrl()}
          loading={panelLoading}
        />
        <ExplanationPanel
          ref={explanationRef}
          relationship={relationship}
          turningPoint={selectedTurning}
          hasSelectedTurning={selectedTurningDate !== null}
          loading={panelLoading}
        />
      </section>

      <details
        className="method-box"
        open={methodOpen}
        onToggle={(event) => setMethodOpen(event.currentTarget.open)}
      >
        <summary>数据来源与限制</summary>
        <p>
          趋势计算方法：读取本地 MapNews 共享数据库中的 GDELT 结构化事件，将事件的 GoldsteinScale
          合作/冲突信号按报道热度加权汇总到每日，再映射为 0-100 关系温度，50 为中性，并使用 14
          日滚动平均形成趋势线。趋势段解释只比较前后 7 天事件类型和来源线索，不代表确定因果。
        </p>
        <p>
          方法来源参考{" "}
          <a href="https://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf" target="_blank" rel="noreferrer">
            GDELT 2.0 Event Codebook
          </a>
          {" "}中的 GoldsteinScale 字段，以及{" "}
          <a href="https://parusanalytics.com/eventdata/data.dir/cameo.html" target="_blank" rel="noreferrer">
            CAMEO 事件编码框架
          </a>
          。关系温度是媒体事件信号，不是官方外交结论；当前库没有新闻正文和标题，重点报道只展示来源链接线索。
        </p>
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
  payload: RelationshipPayload | null;
  active: boolean;
  candidateLabels: Map<string, string>;
  onClick: () => void;
}) {
  const band = payload?.current_band ?? "接近中性";
  const yesterdayDelta = dailyDelta(payload);
  const temperature = payload?.current_temperature?.toFixed(1) ?? "--";
  return (
    <button type="button" className={`relation-card ${bandClass[band]} ${active ? "active" : ""}`} onClick={onClick}>
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
          <span>温度</span>
          <strong>{temperature}</strong>
          <span className={`card-delta-badge ${yesterdayDelta.kind}`}>{yesterdayDelta.label.replace("较昨日 ", "")}</span>
        </span>
      </span>
      <span className="card-sparkline-wrap">
        <MiniSparkline trend={payload?.trend ?? []} />
      </span>
      <span className="card-cta">点击分析→</span>
    </button>
  );
}

function MiniSparkline({ trend }: { trend: RelationshipPayload["trend"] }) {
  const points = sparklinePoints(trend, 150, 44, 3);
  const latestPoint = points[points.length - 1];
  return (
    <svg className="sparkline" viewBox="0 0 150 44" role="img" aria-label="迷你趋势线">
      <path d={chartPath(points)} fill="none" stroke="currentColor" strokeWidth="2.4" />
      {latestPoint ? <circle cx={latestPoint.x} cy={latestPoint.y} r="3.2" className="sparkline-end-dot" /> : null}
    </svg>
  );
}

function FlagPair({ objects }: { objects: readonly string[] }) {
  return (
    <span className="pair-flags" aria-hidden="true">
      {objects.map((objectId) => (
        <span key={objectId} className="flag-item">
          <span className="flag-icon">{objectFlags[objectId] ?? ""}</span>
        </span>
      ))}
    </span>
  );
}

function pairDisplayName(
  objects: readonly string[],
  candidateLabels: Map<string, string>,
  separator = " - "
): string {
  return objects.map((objectId) => candidateLabels.get(objectId) ?? objectId.toUpperCase()).join(separator);
}

function RelationshipChart({
  relationship,
  selectedTurningDate,
  onSelectTurning,
  rangeDays,
  onRangeChange,
  candidateLabels,
  shareStatus,
  onShare,
  loading
}: {
  relationship: RelationshipPayload | null;
  selectedTurningDate: string | null;
  onSelectTurning: (date: string) => void;
  rangeDays: ChartRangeDays;
  onRangeChange: (rangeDays: ChartRangeDays) => void;
  candidateLabels: Map<string, string>;
  shareStatus: "idle" | "copied" | "failed";
  onShare: () => void;
  loading: boolean;
}) {
  const width = 720;
  const height = 360;
  const padding = 48;
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
  const relationshipObjects = relationship ? [relationship.object_a, relationship.object_b] : [];
  const chartTitle = relationship
    ? `${pairDisplayName(relationshipObjects, candidateLabels, "-")}关系温度趋势`
    : "暂无数据";
  const chartAccent = relationship?.current_band ? bandColor[relationship.current_band] : bandColor["接近中性"];
  const chartStyle = { "--chart-accent": chartAccent } as CSSProperties;

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
    <section className={`chart-panel ${loading ? "panel-busy" : ""}`} style={chartStyle} aria-label="关系温度趋势图">
      <div className="panel-heading chart-heading">
        <div className="chart-identity">
          <FlagPair objects={relationshipObjects} />
          <div>
            <h2>{chartTitle}</h2>
          </div>
        </div>
        <div className="chart-actions">
          <div className="score-block">
            <span>{relationship?.data_end ? `${relationship.data_end}日温度` : "等待数据"}</span>
            <strong>{relationship?.current_temperature?.toFixed(1) ?? "--"}</strong>
          </div>
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="range-control" aria-label="图表范围">
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
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`chart ${rangeFading ? "range-fading" : ""}`}
        style={chartStyle}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <linearGradient id="trendAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chartAccent} stopOpacity="0.24" />
            <stop offset="62%" stopColor={chartAccent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={chartAccent} stopOpacity="0" />
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
        <text
          x="18"
          y={height / 2}
          className="axis-title"
          textAnchor="middle"
          transform={`rotate(-90 18 ${height / 2})`}
        >
          关系温度
        </text>
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
          const labelAnchor = segment[Math.floor(segment.length / 2)] ?? endPoint;
          const labelY = Math.max(padding + 16, labelAnchor.y - 28);
          return (
            <g
              key={point.date}
              role="button"
              tabIndex={0}
              className={`trend-segment-group ${selected ? "selected" : ""}`}
              onClick={() => onSelectTurning(point.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
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
              <line
                x1={labelAnchor.x}
                x2={labelAnchor.x}
                y1={labelAnchor.y - 4}
                y2={labelY + 8}
                className={`segment-value-line ${directionClass}`}
              />
              <text
                x={labelAnchor.x}
                y={labelY}
                className={`segment-label ${directionClass}`}
                textAnchor="middle"
              >
                {formatDelta(point.delta)}
              </text>
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
        <button type="button" className="share-button" onClick={onShare}>
          {shareStatus === "copied" ? "已复制" : shareStatus === "failed" ? "复制失败" : "分享"}
        </button>
      </div>
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
        <text x="10" y="34">{`温度 ${point.temperature.toFixed(1)}`}</text>
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
  loading: boolean;
}>(function ExplanationPanel({ relationship, turningPoint, hasSelectedTurning, loading }, ref) {
  if (relationship === null || relationship.turning_point_status === "no_data") {
    return (
      <section ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
        <h2>趋势段解释</h2>
        <p className="muted">当前组合暂无足够事件数据。</p>
        {loading ? <PanelLoading /> : null}
      </section>
    );
  }
  if (turningPoint === null) {
    return (
      <section ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
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
  return (
    <section ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
      <div className="explain-heading">
        <h2>{turningPoint.direction === "改善" ? "关系改善" : "关系恶化"} {formatDelta(turningPoint.delta)}</h2>
        <p className="eyebrow">{turningPoint.previous_date} 至 {turningPoint.date}</p>
      </div>
      <p>{turningPoint.summary}</p>
      <div className="driver-list">
        {turningPoint.drivers.map((driver) => (
          <span key={`${driver.event_root_code}-${driver.label}`}>{driver.label}</span>
        ))}
      </div>
      <div className="reports-heading">
        <h3>相关报道线索</h3>
        <p>按变化窗口内、方向一致、匹配驱动事件和来源多样性排序；点击打开原始报道。</p>
      </div>
      <div className="reports">
        {turningPoint.reports.map((report) => (
          <a key={report.source_url} href={report.source_url} target="_blank" rel="noreferrer">
            <strong>{report.url_title}</strong>
            <small className="report-meta">
              <span>{report.source_domain} · {report.event_type}</span>
              <time dateTime={report.date}>{report.date}</time>
            </small>
          </a>
        ))}
      </div>
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

function dailyDelta(payload: RelationshipPayload | null): { label: string; kind: "up" | "down" | "flat" } {
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
  trend: RelationshipPayload["trend"],
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
