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
import {
  defaultLocale,
  getDashboardCopy,
  getObjectName,
  localeMeta,
  localizedPath,
  relationshipStatusLabel,
  supportedLocales,
  type DashboardCopy,
  type Locale
} from "@/lib/i18n";
import { buildPairSeoSummary, localizedPairCanonicalPath, type PairSeoSummary } from "@/lib/pairSeo";
import type {
  AiExplanationResponse,
  LocalizedAiExplanation,
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
const currentAiPromptVersion = "report-i18n-v1";
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

interface TrendPageProps {
  initialPair?: string;
  initialSeoSummary?: PairSeoSummary | null;
  locale?: Locale;
}

export default function TrendDashboard({
  initialPair = "chn_usa",
  initialSeoSummary = null,
  locale = defaultLocale
}: TrendPageProps) {
  return <TrendApp initialPair={initialPair} initialSeoSummary={initialSeoSummary} locale={locale} />;
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

function TrendApp({
  initialPair,
  initialSeoSummary,
  locale
}: {
  initialPair: string;
  initialSeoSummary: PairSeoSummary | null;
  locale: Locale;
}) {
  const copy = getDashboardCopy(locale);
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
  const [canonicalContentMode, setCanonicalContentMode] = useState(initialSeoSummary !== null);
  const explanationRef = useRef<HTMLElement | null>(null);
  const wechatCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareResetTimer = useRef<number | null>(null);
  const contentUpdateTimer = useRef<number | null>(null);
  const draftAutoLoadTimer = useRef<number | null>(null);
  const hasLoadedOnce = useRef(false);
  const initialPairRef = useRef(initialPair);
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
        setAiMessage(caught instanceof Error ? caught.message : copy.explanation.aiRequestFailed);
      }
    } finally {
      markAiPending(requestKey, false);
    }
  }, [copy.explanation.aiRequestFailed, markAiPending]);

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

  const loadPair = useCallback(async (pair: string, options: { warmAi?: boolean; updateUrl?: boolean } = {}) => {
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
      if (options.updateUrl) {
        const url = new URL(window.location.href);
        url.pathname = localizedPairCanonicalPath(payload.pairId, locale);
        url.search = "";
        url.hash = "";
        window.history.replaceState({}, "", url);
        setCanonicalContentMode(true);
      }
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
  }, [locale, warmRelationshipAi]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    const hasLegacyPairParam = params.has("pair");
    const requestedPair = params.get("pair") ?? initialPairRef.current;
    void loadPair(requestedPair, {
      updateUrl: hasLegacyPairParam || pathname.startsWith("/bilateral/") || pathname.startsWith("/trend/")
    });
  }, [loadPair]);

  useEffect(() => () => {
    if (draftAutoLoadTimer.current !== null) {
      window.clearTimeout(draftAutoLoadTimer.current);
    }
  }, []);

  useEffect(() => {
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      document.querySelectorAll<HTMLDetailsElement>(".dismissible-dropdown[open]").forEach((menu) => {
        if (!menu.contains(target)) {
          menu.open = false;
        }
      });
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const openMenus = Array.from(document.querySelectorAll<HTMLDetailsElement>(".dismissible-dropdown[open]"));
      if (openMenus.length === 0) {
        return;
      }
      event.preventDefault();
      openMenus.forEach((menu) => {
        menu.open = false;
      });
      openMenus[0]?.querySelector<HTMLElement>("summary")?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
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
    () => new Map(candidates.map((candidate) => [candidate.id, getObjectName(locale, candidate.id)])),
    [candidates, locale]
  );
  const relationship = data?.relationship ?? null;
  const seoSummary = useMemo(
    () => (canonicalContentMode && relationship ? buildPairSeoSummary(relationship.pair_id, relationship, locale) : initialSeoSummary),
    [canonicalContentMode, initialSeoSummary, locale, relationship]
  );
  const languageOptions = useMemo(
    () => supportedLocales.map((targetLocale) => ({
      locale: targetLocale,
      href: canonicalContentMode ? localizedPairCanonicalPath(selectedPair, targetLocale) : localizedPath(targetLocale, "/")
    })),
    [canonicalContentMode, selectedPair]
  );
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
      void loadPair(pair, { warmAi: true, updateUrl: true });
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
              <strong>{copy.topbar.subtitleStrong}</strong>: {copy.topbar.subtitleRest}
            </p>
            <div className="signal-row" aria-label={copy.topbar.signalsLabel}>
              <span className="signal">
                <span className="signal-dot" aria-hidden="true" />
                {copy.topbar.dataSignal}
              </span>
              <span className="signal">
                <span className="signal-dot warm" aria-hidden="true" />
                {copy.topbar.aiSignal}
              </span>
            </div>
          </div>

          <button
            className="icon-button mobile-toggle"
            type="button"
            aria-expanded={headerActionsOpen}
            aria-controls="header-actions"
            aria-label={headerActionsOpen ? copy.topbar.collapseActions : copy.topbar.expandActions}
            onClick={() => setHeaderActionsOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="header-actions" id="header-actions">
          <div className="action-stack" aria-label={copy.topbar.projectLinks}>
            <a
              className="header-link primary github-project-link"
              href="https://github.com/Haullk/relationship-temperature"
              target="_blank"
              rel="noreferrer"
              aria-label={copy.topbar.githubAria}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 .5C5.65.5.85 5.38.85 11.75c0 4.98 3.23 9.2 7.72 10.69.56.1.77-.24.77-.54v-2.02c-3.14.68-3.8-1.35-3.8-1.35-.51-1.31-1.25-1.66-1.25-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.39-1.23.71-1.51-2.51-.28-5.15-1.25-5.15-5.57 0-1.23.44-2.24 1.17-3.03-.12-.29-.51-1.44.11-2.99 0 0 .96-.31 3.13 1.16.91-.25 1.88-.38 2.85-.38s1.94.13 2.85.38c2.17-1.47 3.13-1.16 3.13-1.16.62 1.55.23 2.7.11 2.99.73.79 1.17 1.8 1.17 3.03 0 4.33-2.65 5.28-5.17 5.56.41.35.77 1.04.77 2.11v3.13c0 .3.2.65.78.54a11.27 11.27 0 0 0 7.71-10.69C23.15 5.38 18.35.5 12 .5Z"
                />
              </svg>
              GitHub
            </a>
            <a className="header-link email-link" href="mailto:helioshulk@gmail.com" aria-label={copy.topbar.emailAria}>
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
              helioshulk@gmail.com
            </a>
            <button className="header-link wechat-link" type="button" aria-label={copy.topbar.wechatAria} onClick={() => setWechatOpen(true)}>
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
              {copy.topbar.wechat}
            </button>
          </div>

          <div className="status-row">
            <details className="language-menu dismissible-dropdown">
              <summary className="language-trigger" aria-label={copy.topbar.languageSelector}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 5.5h16M4 12h16M4 18.5h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                  <path
                    d="M12 4.75c1.75 1.78 2.75 4.35 2.75 7.25s-1 5.47-2.75 7.25C10.25 17.47 9.25 14.9 9.25 12s1-5.47 2.75-7.25Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                <span>{localeMeta[locale].label}</span>
                <svg className="language-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              </summary>
              <div className="language-menu-panel" role="menu" aria-label={copy.topbar.languageSelector}>
                {languageOptions.map((option) => (
                  <a
                    key={option.locale}
                    className="language-option"
                    href={option.href}
                    hrefLang={localeMeta[option.locale].htmlLang}
                    role="menuitem"
                    aria-current={option.locale === locale ? "true" : undefined}
                  >
                    <span>{localeMeta[option.locale].label}</span>
                    {option.locale === locale ? <span className="language-current">{copy.topbar.languageCurrent}</span> : null}
                  </a>
                ))}
              </div>
            </details>
            <aside className="status-card" aria-label={copy.topbar.statusAria}>
              <span className="live-dot" aria-hidden="true" />
              <span>{copy.topbar.latestData}</span>
              {relationship?.data_end ? <time dateTime={relationship.data_end}>{relationship.data_end}</time> : <span>{copy.topbar.waitingCache}</span>}
            </aside>
          </div>
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
              aria-label={copy.topbar.closeWechat}
              onClick={() => setWechatOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
            <div>
              <h2 id="wechat-modal-title">{copy.topbar.wechatTitle}</h2>
              <p id="wechat-modal-description">{copy.topbar.wechatDescription}</p>
            </div>
            <Image className="wechat-qr" src="/wechat-qr.jpg" alt={copy.topbar.qrAlt} width={430} height={430} />
          </section>
        </div>
      ) : null}

      {initialLoading ? <Skeleton copy={copy} /> : null}
      {slow ? <Notice tone="warn" text={copy.notices.slow} copy={copy} /> : null}
      {error ? <Notice tone="error" text={copy.notices.apiFailed(error)} action={() => void loadPair(selectedPair)} copy={copy} /> : null}
      {!loading && data?.message ? <Notice tone="warn" text={data.message} copy={copy} /> : null}
      {!loading && data?.cacheStatus === "stale" ? <Notice tone="warn" text={copy.notices.stale} copy={copy} /> : null}

      <section className="featured-strip" aria-label={copy.featuredAria}>
        {featuredPairs.map((pair) => (
          <RelationshipCard
            key={pair.pairId}
            pair={pair}
            payload={data?.featuredCards.find((card) => card.pair_id === pair.pairId) ?? null}
            active={pair.pairId === selectedPair}
            candidateLabels={candidateLabels}
            locale={locale}
            copy={copy}
            onClick={() => void loadPair(pair.pairId, { warmAi: true, updateUrl: true })}
          />
        ))}
      </section>

      {!loading && candidates.length < 2 ? <Notice tone="error" text={copy.notices.configInsufficient} copy={copy} /> : null}
      {!loading && hasNoData ? <Notice tone="warn" text={copy.notices.noData} copy={copy} /> : null}
      {!loading && relationship?.turning_point_status === "data_insufficient" ? <Notice tone="warn" text={copy.notices.insufficient} copy={copy} /> : null}
      {!loading && relationship?.turning_point_status === "no_significant_turning_points" ? (
        <Notice tone="info" text={copy.notices.noTurningPoints} copy={copy} />
      ) : null}

      {seoSummary ? <RelationshipSeoBrief summary={seoSummary} copy={copy} /> : null}

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
          locale={locale}
          copy={copy}
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
          locale={locale}
          copy={copy}
        />
      </section>

      <details
        className="method-box"
        open={methodOpen}
        onToggle={(event) => setMethodOpen(event.currentTarget.open)}
      >
        <summary>{copy.method.title}</summary>
        <p className="method-lead">{copy.method.lead}</p>
        <div className="method-grid">
          <section>
            <h3>{copy.method.indexTitle}</h3>
            <p>{copy.method.indexBody}</p>
          </section>
          <section>
            <h3>{copy.method.aiTitle}</h3>
            <p>{copy.method.aiBody}</p>
          </section>
          <section>
            <h3>{copy.method.noteTitle}</h3>
            <p>
              {copy.method.notePrefix}{" "}
              <a href="https://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf" target="_blank" rel="noreferrer">
                GDELT 2.0
              </a>
              {" "}{copy.method.and}{" "}
              <a href="https://parusanalytics.com/eventdata/data.dir/cameo.html" target="_blank" rel="noreferrer">
                {copy.method.cameoLink}
              </a>
              {copy.method.noteSuffix}
            </p>
          </section>
        </div>
      </details>
    </main>
  );
}

function RelationshipSeoBrief({ summary, copy }: { summary: PairSeoSummary; copy: DashboardCopy }) {
  const currentIndex = summary.currentTemperature === null ? "--" : summary.currentTemperature.toFixed(1);
  const dataDate = summary.dataEnd ?? copy.seoBrief.waiting;

  return (
    <details className="relationship-brief" aria-label={copy.seoBrief.aria(summary.localizedName)}>
      <summary className="relationship-brief-summary">
        <span className="relationship-brief-summary-copy">
          <span className="relationship-brief-kicker">{copy.seoBrief.kicker(summary.englishName)}</span>
          <span className="relationship-brief-title">{copy.seoBrief.title(summary.localizedName)}</span>
        </span>
        <span className="relationship-brief-summary-meta">
          <span>
            <span>{copy.seoBrief.currentIndex}</span>
            <strong>{currentIndex}</strong>
          </span>
          <span>
            <span>{copy.seoBrief.updated}</span>
            <strong>{dataDate}</strong>
          </span>
        </span>
        <span className="relationship-brief-toggle" aria-hidden="true">
          <span className="relationship-brief-toggle-closed">{copy.seoBrief.open}</span>
          <span className="relationship-brief-toggle-open">{copy.seoBrief.close}</span>
        </span>
      </summary>
      <div className="relationship-brief-body">
        <div className="relationship-brief-copy">
          <h2>{copy.seoBrief.indexTitle(summary.localizedName)}</h2>
          <p>{summary.brief}</p>
          <p>{summary.readingGuide}</p>
          <p>{summary.methodNote}</p>
        </div>
        <dl className="relationship-brief-facts">
          <div>
            <dt>{copy.seoBrief.currentIndex}</dt>
            <dd>{currentIndex}</dd>
          </div>
          <div>
            <dt>{copy.seoBrief.status}</dt>
            <dd>{summary.statusLabel ?? copy.status.observing}</dd>
          </div>
          <div>
            <dt>{copy.seoBrief.updated}</dt>
            <dd>{dataDate}</dd>
          </div>
          <div>
            <dt>{copy.seoBrief.dataRange}</dt>
            <dd>{summary.dataStart && summary.dataEnd ? copy.seoBrief.range(summary.dataStart, summary.dataEnd) : copy.seoBrief.days90}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

function RelationshipCard({
  pair,
  payload,
  active,
  candidateLabels,
  locale,
  copy,
  onClick
}: {
  pair: FeaturedPair;
  payload: FeaturedCardPayload | null;
  active: boolean;
  candidateLabels: Map<string, string>;
  locale: Locale;
  copy: DashboardCopy;
  onClick: () => void;
}) {
  const visualBand = indexVisualBand(payload?.current_temperature);
  const yesterdayDelta = dailyDelta(payload, copy);
  const temperature = payload?.current_temperature?.toFixed(1) ?? "--";
  const statusLabel = relationshipStatusLabel(locale, payload?.current_temperature);
  const pairName = pair.objects
    .map((objectId) => candidateLabels.get(objectId) ?? objectId.toUpperCase())
    .join(" / ");
  return (
    <button
      type="button"
      className={`relation-card ${visualBand} ${active ? "active" : ""}`}
      onClick={onClick}
      aria-label={copy.card.aria(pairName, temperature, statusLabel, yesterdayDelta.label)}
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
          <span>{copy.card.index}</span>
          <strong>{temperature}</strong>
          <span className={`card-delta-badge ${yesterdayDelta.kind}`}>{yesterdayDelta.shortLabel}</span>
        </span>
      </span>
      <span className="card-sparkline-wrap">
        <MiniSparkline trend={payload?.trend ?? []} copy={copy} />
      </span>
      <span className="card-status-row">
        <span>{statusLabel}</span>
        <span className="card-action">{copy.card.view}</span>
      </span>
    </button>
  );
}

function MiniSparkline({ trend, copy }: { trend: readonly FeaturedTrendPoint[]; copy: DashboardCopy }) {
  const points = sparklinePoints(trend, 150, 44, 3);
  const latestPoint = points[points.length - 1];
  return (
    <svg className="sparkline" viewBox="0 0 150 44" role="img" aria-label={copy.card.sparklineAria}>
      <path d={chartPath(points)} fill="none" stroke="currentColor" strokeWidth="2.4" />
      {latestPoint ? <circle cx={latestPoint.x} cy={latestPoint.y} r="3.2" className="sparkline-end-dot" /> : null}
    </svg>
  );
}

function ObjectDropdown({
  value,
  candidates,
  disabled,
  isOptionDisabled,
  onChange,
  locale,
  ariaLabel
}: {
  value: string;
  candidates: TrendApiResponse["candidatePool"]["objects"];
  disabled: boolean;
  isOptionDisabled: (objectId: string) => boolean;
  onChange: (objectId: string) => void;
  locale: Locale;
  ariaLabel: string;
}) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const selectedLabel = getObjectName(locale, value);
  const selectedFlag = objectFlags[value] ?? "";

  function closeMenu() {
    if (menuRef.current !== null) {
      menuRef.current.open = false;
    }
  }

  return (
    <details ref={menuRef} className={`object-dropdown dismissible-dropdown${disabled ? " is-disabled" : ""}`}>
      <summary
        className="object-dropdown-trigger"
        aria-label={ariaLabel}
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        <span className="object-dropdown-current">
          {selectedFlag ? <span className="object-dropdown-flag" aria-hidden="true">{selectedFlag}</span> : null}
          <span className="object-dropdown-label">{selectedLabel}</span>
        </span>
        <svg className="object-dropdown-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </summary>
      <div className="object-dropdown-panel" role="menu" aria-label={ariaLabel}>
        {candidates.map((candidate) => {
          const optionDisabled = isOptionDisabled(candidate.id);
          const selected = candidate.id === value;
          return (
            <button
              key={candidate.id}
              className="object-dropdown-option"
              type="button"
              role="menuitem"
              disabled={optionDisabled}
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                if (optionDisabled) {
                  return;
                }
                onChange(candidate.id);
                closeMenu();
              }}
            >
              <span className="object-dropdown-option-main">
                {objectFlags[candidate.id] ? <span className="object-dropdown-flag" aria-hidden="true">{objectFlags[candidate.id]}</span> : null}
                <span>{getObjectName(locale, candidate.id)}</span>
              </span>
              {selected ? <span className="object-dropdown-check" aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
    </details>
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
  loading,
  locale,
  copy
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
  locale: Locale;
  copy: DashboardCopy;
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
    () => new Map(candidates.map((candidate) => [candidate.id, getObjectName(locale, candidate.id)])),
    [candidates, locale]
  );
  const relationshipObjects = relationship ? [relationship.object_a, relationship.object_b] : [];
  const relationshipTitle = relationshipObjects.length > 0
    ? relationshipObjects.map((objectId) => chartCandidateLabels.get(objectId) ?? objectId.toUpperCase()).join(" / ")
    : copy.chart.noDataTitle;
  const chartAccent = indexVisualColor(relationship?.current_temperature);
  const chartStyle = { "--chart-accent": chartAccent } as CSSProperties;
  const currentDelta = dailyDelta(relationship, copy);
  const scoreValue = relationship?.current_temperature?.toFixed(1) ?? "--";
  const scoreDateLabel = copy.chart.scoreDate(relationship?.data_end ?? null);
  const statusLabel = relationshipStatusLabel(locale, relationship?.current_temperature);
  const sideLabels = [
    { tick: 100, label: copy.chart.sideLabels.high },
    { tick: 50, label: copy.chart.sideLabels.middle },
    { tick: 0, label: copy.chart.sideLabels.low }
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
    <section className={`chart-panel ${loading ? "panel-busy" : ""}`} style={chartStyle} aria-label={copy.chart.panelAria}>
      <div className="panel-heading chart-heading">
        <div className="chart-heading-row chart-heading-primary">
          <div className="chart-selector-row" aria-label={copy.chart.selectorAria}>
            <ObjectDropdown
              value={draftObjectA}
              disabled={candidates.length < 2}
              candidates={candidates}
              isOptionDisabled={(objectId) => !isLegalPair(objectId, draftObjectB, legalPairIds)}
              onChange={onDraftObjectAChange}
              locale={locale}
              ariaLabel={copy.chart.selectorAria}
            />
            <span className="chart-pair-divider" aria-hidden="true">—</span>
            <ObjectDropdown
              value={draftObjectB}
              disabled={candidates.length < 2}
              candidates={candidates}
              isOptionDisabled={(objectId) => !isLegalPair(draftObjectA, objectId, legalPairIds)}
              onChange={onDraftObjectBChange}
              locale={locale}
              ariaLabel={copy.chart.selectorAria}
            />
          </div>
          <div className="range-control chart-range-control" aria-label={copy.chart.rangeAria}>
            {chartRanges.map((days) => (
              <button
                key={days}
                type="button"
                className={rangeDays === days ? "active" : ""}
                onClick={() => onRangeChange(days)}
              >
                {copy.chart.rangeDays(days)}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-heading-row chart-heading-secondary">
          <div className="chart-title-block">
            <h2>{relationshipTitle}</h2>
            <p className="chart-context">
              {relationshipObjects.length > 0 ? `${statusLabel} · ${copy.chart.trendContext}` : copy.chart.waitingCache}
            </p>
          </div>
          <div className="score-inline" aria-label={scoreDateLabel}>
            <span className="score-date">{scoreDateLabel}</span>
            <strong>{scoreValue}</strong>
            <span className={`score-delta ${currentDelta.kind}`}>{currentDelta.shortLabel}</span>
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
        <g className="chart-svg-legend" role="img" aria-label={copy.chart.legendAria} transform={`translate(${width / 2 - 238}, 20)`}>
          <line x1="0" x2="16" y1="0" y2="0" className="chart-svg-legend-line improve" />
          <text x="24" y="4">{copy.chart.legendImprove}</text>
          <line x1="190" x2="206" y1="0" y2="0" className="chart-svg-legend-line neutral" />
          <text x="214" y="4">{copy.chart.legendNeutral}</text>
          <line x1="318" x2="334" y1="0" y2="0" className="chart-svg-legend-line worsen" />
          <text x="342" y="4">{copy.chart.legendWorsen}</text>
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
              aria-label={`${copy.dates.range(point.previous_date, point.date)}, ${changeLabel(point.direction, copy)} ${formatDelta(point.delta)}`}
              aria-pressed={selected}
              onClick={() => onSelectTurning(point.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectTurning(point.date);
                }
              }}
            >
              <title>{`${copy.dates.range(point.previous_date, point.date)} · ${changeLabel(point.direction, copy)} ${formatDelta(point.delta)}`}</title>
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
        {hoveredPoint ? <HoverGuide point={hoveredPoint} width={width} height={height} padding={padding} copy={copy} /> : null}
      </svg>
      <div className="chart-footer">
          <div className="chart-guide">
          <p className="chart-reading-note">{copy.chart.readingNote}</p>
        </div>
        <button type="button" className="share-button" onClick={onShare}>
          {shareStatus === "copied" ? copy.chart.copied : shareStatus === "failed" ? copy.chart.copyFailed : copy.chart.share}
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
            <span>{copy.chart.currentSegment}</span>
            <strong>{`${changeLabel(selectedTurningPoint.direction, copy)} ${formatDelta(selectedTurningPoint.delta)}`}</strong>
            <span>{compactDateRange(selectedTurningPoint.previous_date, selectedTurningPoint.date, copy)}</span>
          </span>
          <span className="mobile-explanation-action">{copy.chart.viewExplanation}</span>
        </button>
      ) : null}
      {loading ? <PanelLoading copy={copy} /> : null}
    </section>
  );
}

function HoverGuide({
  point,
  width,
  height,
  padding,
  copy
}: {
  point: ChartPoint;
  width: number;
  height: number;
  padding: number;
  copy: DashboardCopy;
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
        <text x="10" y="34">{copy.chart.indexTooltip(point.temperature.toFixed(1))}</text>
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

function changeLabel(direction: string, copy: DashboardCopy): string {
  if (direction === "改善") {
    return copy.change.improve;
  }
  if (direction === "恶化") {
    return copy.change.worsen;
  }
  return copy.change.stable;
}

const ExplanationPanel = forwardRef<HTMLElement, {
  relationship: RelationshipPayload | null;
  turningPoint: TurningPoint | null;
  hasSelectedTurning: boolean;
  aiPending: boolean;
  aiMessage: string | null;
  onRequestAi: (() => void) | null;
  loading: boolean;
  locale: Locale;
  copy: DashboardCopy;
}>(function ExplanationPanel({ relationship, turningPoint, hasSelectedTurning, aiPending, aiMessage, onRequestAi, loading, locale, copy }, ref) {
  const [activeTab, setActiveTab] = useState<"analysis" | "reports">("analysis");

  useEffect(() => {
    setActiveTab("analysis");
  }, [relationship?.pair_id, turningPoint?.date]);

  if (relationship === null || relationship.turning_point_status === "no_data") {
    return (
      <section id="explanation-panel" ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
        <h2>{copy.explanation.title}</h2>
        <p className="muted">{copy.explanation.noData}</p>
        {loading ? <PanelLoading copy={copy} /> : null}
      </section>
    );
  }
  if (turningPoint === null) {
    return (
      <section id="explanation-panel" ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
        <h2>{copy.explanation.title}</h2>
        <p className="muted">
          {relationship.turning_points.length > 0 && !hasSelectedTurning
            ? copy.explanation.clickSegment
            : copy.explanation.noTurningPoints}
        </p>
        {loading ? <PanelLoading copy={copy} /> : null}
      </section>
    );
  }
  const hasAiSummary = turningPoint.ai_status === "ready" && Boolean(turningPoint.ai_summary);
  const localizedExplanation = buildLocalizedExplanation(relationship, turningPoint, {
    hasAiSummary,
    locale,
    copy
  });
  const { summary, evidence: visibleEvidence, mainEvent } = localizedExplanation;
  const aiNotice = aiStatusNotice(turningPoint, { hasAiSummary, aiPending, aiMessage }, copy);
  const canRequestAi = !hasAiSummary && !aiPending && turningPoint.ai_status !== "missing_key" && onRequestAi !== null;
  const directionClass = turningPoint.direction === "改善" ? "improve" : "worsen";
  const directionTitle = copy.explanation.directionTitle(turningPoint.direction);
  return (
    <section id="explanation-panel" ref={ref} className={`explain-panel ${loading ? "panel-busy" : ""}`}>
      <div className="explain-heading">
        <div className="explain-heading-main">
          <div className="explain-heading-copy">
            <h2>{directionTitle}</h2>
            <p className="eyebrow">{compactDateRange(turningPoint.previous_date, turningPoint.date, copy)}</p>
          </div>
          <strong className={`explain-delta ${directionClass}`}>{formatDelta(turningPoint.delta)}</strong>
        </div>
      </div>

      {mainEvent ? (
        <div className="ai-main-event">
          <span className="ai-main-event-label">{copy.explanation.mainLine}</span>
          <strong>{mainEvent}</strong>
        </div>
      ) : null}

      <div className="explain-tabs" role="tablist" aria-label={copy.explanation.tabsAria}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "analysis"}
          className={activeTab === "analysis" ? "active" : ""}
          onClick={() => setActiveTab("analysis")}
        >
          {copy.explanation.analysis}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reports"}
          className={activeTab === "reports" ? "active" : ""}
          onClick={() => setActiveTab("reports")}
        >
          <span>{copy.explanation.reports}</span>
          <span className="tab-count">{turningPoint.reports.length}</span>
        </button>
      </div>

      {activeTab === "analysis" ? (
        <div className="explain-tab-panel analysis-tab" role="tabpanel">
          <p className="explain-summary">{summary}</p>
          {aiPending ? <p className="ai-status">{copy.explanation.generating}</p> : null}
          {aiNotice ? (
            <div className={`ai-status-row ${aiNotice.tone}`}>
              <p className="ai-status">{aiNotice.text}</p>
              {canRequestAi ? (
                <button type="button" className="ai-status-action" onClick={() => onRequestAi?.()}>
                  {turningPoint.ai_status === "error" ? copy.explanation.retry : copy.explanation.generate}
                </button>
              ) : null}
            </div>
          ) : null}
          {visibleEvidence.length ? (
            <div className="evidence-block">
              <h3>{copy.explanation.evidence}</h3>
              <ul className="ai-evidence-list" aria-label={copy.explanation.evidenceAria}>
                {visibleEvidence.map((evidence, index) => {
                  const parsedEvidence = splitEvidenceLine(evidence);
                  return (
                    <li key={`${evidence}-${index}`}>
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
              <span key={`${driver.event_root_code}-${driver.label}`}>
                {localizedEventLabel(driver.label, driver.event_root_code, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="explain-tab-panel reports-tab" role="tabpanel">
          <div className="reports">
            {uniqueReports(turningPoint.reports, locale, copy).map((report) => (
              <a key={report.source_url} href={report.source_url} target="_blank" rel="noreferrer">
                <strong>{reportTitle(report, locale, copy)}</strong>
                {reportSummary(report, locale) ? <span className="report-summary">{reportSummary(report, locale)}</span> : null}
                <small className="report-meta">
                  <span>{cleanDomain(report.source_domain, copy)} · {localizedEventLabel(report.event_type, undefined, locale)}</span>
                  <time dateTime={report.date}>{report.date}</time>
                </small>
              </a>
            ))}
          </div>
        </div>
      )}
      {loading ? <PanelLoading copy={copy} /> : null}
    </section>
  );
});

function PanelLoading({ copy }: { copy: DashboardCopy }) {
  return (
    <div className="panel-loading" role="status" aria-live="polite">
      {copy.explanation.loading}
    </div>
  );
}

type LocalizedExplanationText = {
  summary: string;
  mainEvent: string;
  evidence: string[];
};

function buildLocalizedExplanation(
  relationship: RelationshipPayload,
  turningPoint: TurningPoint,
  options: { hasAiSummary: boolean; locale: Locale; copy: DashboardCopy }
): LocalizedExplanationText {
  const { hasAiSummary, locale, copy } = options;
  const aiSummary = relationshipIndexCopy(cleanRelativeTimePrefix(turningPoint.ai_summary));
  const aiMainEvent = relationshipIndexCopy(turningPoint.ai_main_event);
  const aiEvidence = (turningPoint.ai_evidence ?? []).map(relationshipIndexCopy);
  const localizedAi = hasAiSummary ? localizedAiForLocale(turningPoint, locale) : null;

  if (localizedAi !== null) {
    return {
      summary: localizedAi.summary || localizedRuleSummary(relationship, turningPoint, locale),
      mainEvent: localizedAi.mainEvent || fallbackMainEvent(relationship, turningPoint, locale),
      evidence: localizedAi.evidence.length ? localizedAi.evidence : reportEvidence(turningPoint, locale, copy)
    };
  }

  if (locale === "zh-CN") {
    return {
      summary: hasAiSummary ? aiSummary : relationshipIndexCopy(cleanRelativeTimePrefix(turningPoint.summary)),
      mainEvent: hasAiSummary ? aiMainEvent : fallbackMainEvent(relationship, turningPoint, locale),
      evidence: hasAiSummary && aiEvidence.length ? aiEvidence : reportEvidence(turningPoint, locale, copy)
    };
  }

  if (locale === "zh-TW") {
    return {
      summary: toTraditionalChinese(hasAiSummary ? aiSummary : localizedRuleSummary(relationship, turningPoint, locale)),
      mainEvent: toTraditionalChinese(hasAiSummary && aiMainEvent ? aiMainEvent : fallbackMainEvent(relationship, turningPoint, locale)),
      evidence: hasAiSummary && aiEvidence.length
        ? aiEvidence.map(toTraditionalChinese)
        : reportEvidence(turningPoint, locale, copy)
    };
  }

  return {
    summary: localizedRuleSummary(relationship, turningPoint, locale),
    mainEvent: fallbackMainEvent(relationship, turningPoint, locale),
    evidence: reportEvidence(turningPoint, locale, copy)
  };
}

function localizedAiForLocale(turningPoint: TurningPoint, locale: Locale): LocalizedExplanationText | null {
  if (locale === "zh-CN") {
    return null;
  }
  const entry = turningPoint.ai_i18n?.[locale as keyof NonNullable<TurningPoint["ai_i18n"]>];
  if (!entry) {
    return null;
  }
  const normalized = normalizeLocalizedAi(entry, locale);
  if (!normalized.summary && !normalized.mainEvent && normalized.evidence.length === 0) {
    return null;
  }
  return normalized;
}

function normalizeLocalizedAi(entry: LocalizedAiExplanation, locale: Locale): LocalizedExplanationText {
  const normalize = locale === "zh-TW"
    ? (value: string | null | undefined) => toTraditionalChinese(relationshipIndexCopy(cleanRelativeTimePrefix(value)))
    : (value: string | null | undefined) => relationshipIndexCopy(cleanRelativeTimePrefix(value));
  return {
    summary: normalize(entry.summary),
    mainEvent: normalize(entry.main_event),
    evidence: (entry.evidence ?? []).map(normalize).filter((line) => line.length > 0)
  };
}

function localizedRuleSummary(relationship: RelationshipPayload, turningPoint: TurningPoint, locale: Locale): string {
  const pairName = localizedRelationshipName(relationship, locale);
  const delta = Math.abs(turningPoint.delta).toFixed(1);
  const dateRange = `${turningPoint.previous_date} ${dateRangeWord(locale)} ${turningPoint.date}`;
  const drivers = localizedDriverList(turningPoint, locale);
  const reportCount = turningPoint.reports.length;
  const movement = turningPoint.delta >= 0 ? movementUp(locale, delta) : movementDown(locale, delta);
  const driverClause = drivers ? driverClauseForLocale(locale, drivers) : "";

  if (locale === "en") {
    const reportClause = reportCount > 0 ? ` The segment is supported by ${reportCount} related reports.` : "";
    return `${dateRange}, the ${pairName} relationship index ${movement}.${driverClause}${reportClause} Read it as a media-event signal, not a diplomatic conclusion.`;
  }
  if (locale === "ja") {
    const reportClause = reportCount > 0 ? `この区間は${reportCount}件の関連報道にもとづいています。` : "";
    return `${dateRange}、${pairName}の関係指数は${movement}。${driverClause}${reportClause}これはメディア上のイベント信号であり、外交関係そのものの結論ではありません。`;
  }
  if (locale === "ko") {
    const reportClause = reportCount > 0 ? ` 이 구간은 관련 보도 ${reportCount}건을 바탕으로 합니다.` : "";
    return `${dateRange}, ${pairName} 관계 지수는 ${movement}.${driverClause}${reportClause} 이는 언론 이벤트 신호이며 외교 관계 자체에 대한 결론은 아닙니다.`;
  }
  const reportClause = reportCount > 0 ? `此區段同時參考 ${reportCount} 則相關報導。` : "";
  return `${dateRange}，${pairName}關係指數${movement}。${driverClause}${reportClause}這是媒體報導中的事件信號，不等於外交關係結論。`;
}

function fallbackMainEvent(relationship: RelationshipPayload, turningPoint: TurningPoint, locale: Locale): string {
  const drivers = localizedDriverList(turningPoint, locale);
  const pairName = localizedRelationshipName(relationship, locale);
  if (locale === "en") {
    return turningPoint.delta >= 0
      ? `Friendly-leaning media signals lifted the ${pairName} index`
      : `Conflict-leaning media signals pulled the ${pairName} index lower`;
  }
  if (locale === "ja") {
    return turningPoint.delta >= 0
      ? `${pairName}指数を押し上げた友好寄りの報道信号`
      : `${pairName}指数を押し下げた対立寄りの報道信号`;
  }
  if (locale === "ko") {
    return turningPoint.delta >= 0
      ? `${pairName} 지수를 끌어올린 우호 쪽 보도 신호`
      : `${pairName} 지수를 낮춘 갈등 쪽 보도 신호`;
  }
  if (drivers) {
    return turningPoint.delta >= 0 ? `友好信號集中於${drivers}` : `緊張信號集中於${drivers}`;
  }
  return turningPoint.delta >= 0 ? "友好報導信號推升指數" : "緊張報導信號拉低指數";
}

function reportEvidence(turningPoint: TurningPoint, locale: Locale, copy: DashboardCopy): string[] {
  return uniqueReports(turningPoint.reports, locale, copy).slice(0, 6).map((report) => {
    const date = report.date;
    const domain = cleanDomain(report.source_domain, copy);
    const title = reportTitle(report, locale, copy);
    if (locale === "en") {
      return `${date}: ${domain} reported "${title}".`;
    }
    if (locale === "ja") {
      return `${date}：${domain} は「${title}」と報じました。`;
    }
    if (locale === "ko") {
      return `${date}: ${domain} 보도, "${title}".`;
    }
    if (locale === "zh-TW") {
      return `${date}：${domain} 報導「${toTraditionalChinese(title)}」。`;
    }
    return `${date}：${domain} 报道“${title}”。`;
  });
}

function localizedRelationshipName(relationship: RelationshipPayload, locale: Locale): string {
  return [relationship.object_a, relationship.object_b]
    .filter(Boolean)
    .map((objectId) => getObjectName(locale, objectId))
    .join(" / ");
}

function localizedDriverList(turningPoint: TurningPoint, locale: Locale): string {
  const labels = turningPoint.drivers
    .slice(0, 3)
    .map((driver) => localizedEventLabel(driver.label, driver.event_root_code, locale))
    .filter(Boolean);
  return joinLocalizedList([...new Set(labels)], locale);
}

function dateRangeWord(locale: Locale): string {
  if (locale === "en") {
    return "to";
  }
  if (locale === "ja") {
    return "から";
  }
  if (locale === "ko") {
    return "~";
  }
  return "至";
}

function movementUp(locale: Locale, delta: string): string {
  if (locale === "en") {
    return `rose by ${delta} points`;
  }
  if (locale === "ja") {
    return `${delta}ポイント上昇しました`;
  }
  if (locale === "ko") {
    return `${delta}포인트 상승했습니다`;
  }
  return `上升 ${delta} 點`;
}

function movementDown(locale: Locale, delta: string): string {
  if (locale === "en") {
    return `fell by ${delta} points`;
  }
  if (locale === "ja") {
    return `${delta}ポイント低下しました`;
  }
  if (locale === "ko") {
    return `${delta}포인트 하락했습니다`;
  }
  return `下降 ${delta} 點`;
}

function driverClauseForLocale(locale: Locale, drivers: string): string {
  if (locale === "en") {
    return ` Driver signals include ${drivers}.`;
  }
  if (locale === "ja") {
    return `主なイベント信号には${drivers}が含まれます。`;
  }
  if (locale === "ko") {
    return ` 주요 이벤트 신호는 ${drivers}입니다.`;
  }
  return `主要事件信號包括${drivers}。`;
}

function joinLocalizedList(items: string[], locale: Locale): string {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0] ?? "";
  }
  if (locale === "en") {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(items);
  }
  if (locale === "ja") {
    return items.join("、");
  }
  if (locale === "ko") {
    return items.join(", ");
  }
  return items.join("、");
}

const eventLabelTranslations: Record<string, Record<Locale, string>> = {
  "发表声明": { "zh-CN": "发表声明", en: "statements", ja: "声明", "zh-TW": "發表聲明", ko: "성명" },
  "呼吁": { "zh-CN": "呼吁", en: "appeals", ja: "呼びかけ", "zh-TW": "呼籲", ko: "호소" },
  "表达合作意向": { "zh-CN": "表达合作意向", en: "cooperation intent", ja: "協力意向", "zh-TW": "表達合作意向", ko: "협력 의향" },
  "咨询": { "zh-CN": "咨询", en: "consultation", ja: "協議", "zh-TW": "諮詢", ko: "협의" },
  "外交合作": { "zh-CN": "外交合作", en: "diplomatic cooperation", ja: "外交協力", "zh-TW": "外交合作", ko: "외교 협력" },
  "物质合作": { "zh-CN": "物质合作", en: "material cooperation", ja: "物質的協力", "zh-TW": "物質合作", ko: "물질 협력" },
  "提供援助": { "zh-CN": "提供援助", en: "aid", ja: "援助", "zh-TW": "提供援助", ko: "지원" },
  "让步": { "zh-CN": "让步", en: "concessions", ja: "譲歩", "zh-TW": "讓步", ko: "양보" },
  "调查": { "zh-CN": "调查", en: "investigations", ja: "調査", "zh-TW": "調查", ko: "조사" },
  "要求": { "zh-CN": "要求", en: "demands", ja: "要求", "zh-TW": "要求", ko: "요구" },
  "不满": { "zh-CN": "不满", en: "disapproval", ja: "不満表明", "zh-TW": "不滿", ko: "불만 표명" },
  "拒绝": { "zh-CN": "拒绝", en: "rejections", ja: "拒否", "zh-TW": "拒絕", ko: "거부" },
  "威胁": { "zh-CN": "威胁", en: "threats", ja: "脅威", "zh-TW": "威脅", ko: "위협" },
  "抗议": { "zh-CN": "抗议", en: "protests", ja: "抗議", "zh-TW": "抗議", ko: "항의" },
  "展示军事姿态": { "zh-CN": "展示军事姿态", en: "military posture", ja: "軍事的示威", "zh-TW": "展示軍事姿態", ko: "군사적 시위" },
  "减少关系": { "zh-CN": "减少关系", en: "reduced relations", ja: "関係縮小", "zh-TW": "減少關係", ko: "관계 축소" },
  "胁迫": { "zh-CN": "胁迫", en: "coercion", ja: "強制・圧力", "zh-TW": "脅迫", ko: "강압" },
  "攻击": { "zh-CN": "攻击", en: "assaults", ja: "攻撃", "zh-TW": "攻擊", ko: "공격" },
  "战斗": { "zh-CN": "战斗", en: "fighting", ja: "戦闘", "zh-TW": "戰鬥", ko: "전투" },
  "大规模暴力": { "zh-CN": "大规模暴力", en: "mass violence", ja: "大規模暴力", "zh-TW": "大規模暴力", ko: "대규모 폭력" }
};

const eventRootCodeLabels: Record<string, keyof typeof eventLabelTranslations> = {
  "01": "发表声明",
  "02": "呼吁",
  "03": "表达合作意向",
  "04": "咨询",
  "05": "外交合作",
  "06": "物质合作",
  "07": "提供援助",
  "08": "让步",
  "09": "调查",
  "10": "要求",
  "11": "不满",
  "12": "拒绝",
  "13": "威胁",
  "14": "抗议",
  "15": "展示军事姿态",
  "16": "减少关系",
  "17": "胁迫",
  "18": "攻击",
  "19": "战斗",
  "20": "大规模暴力"
};

function localizedEventLabel(label: string, eventRootCode: string | undefined, locale: Locale): string {
  const normalizedLabel = label.trim();
  const rootLabel = eventRootCode ? eventRootCodeLabels[eventRootCode] : undefined;
  const translation = rootLabel ? eventLabelTranslations[rootLabel] : eventLabelTranslations[normalizedLabel];
  if (translation) {
    return translation[locale];
  }
  return locale === "zh-TW" ? toTraditionalChinese(normalizedLabel) : normalizedLabel;
}

function toTraditionalChinese(value: string): string {
  const phraseMap: Array<[string, string]> = [
    ["关系指数", "關係指數"],
    ["关系温度", "關係指數"],
    ["双边关系", "雙邊關係"],
    ["国际关系", "國際關係"],
    ["全球新闻", "全球新聞"],
    ["媒体报道", "媒體報導"],
    ["原始信号", "原始信號"],
    ["趋势解读", "趨勢解讀"],
    ["相关报道", "相關報導"],
    ["证据线索", "證據線索"],
    ["美国", "美國"],
    ["中国", "中國"],
    ["俄罗斯", "俄羅斯"],
    ["欧洲", "歐洲"],
    ["乌克兰", "烏克蘭"],
    ["记者", "記者"],
    ["驱逐", "驅逐"],
    ["芯片", "晶片"],
    ["出口管制", "出口管制"],
    ["境外企业", "境外企業"],
    ["报道", "報導"],
    ["评论", "評論"],
    ["认为", "認為"],
    ["明确", "明確"],
    ["适用于", "適用於"],
    ["显著", "顯著"],
    ["恶化", "惡化"],
    ["紧张", "緊張"],
    ["态势", "態勢"],
    ["升级", "升級"],
    ["信号", "信號"],
    ["解读", "解讀"],
    ["限制", "限制"],
    ["收紧", "收緊"],
    ["进一步", "進一步"]
  ];
  let converted = value;
  for (const [source, target] of phraseMap) {
    converted = converted.replaceAll(source, target);
  }
  const charMap: Record<string, string> = {
    万: "萬", 与: "與", 专: "專", 业: "業", 东: "東", 丝: "絲", 严: "嚴", 丧: "喪",
    个: "個", 临: "臨", 为: "為", 举: "舉", 义: "義", 乌: "烏", 乐: "樂", 习: "習",
    乡: "鄉", 书: "書", 买: "買", 乱: "亂", 争: "爭", 于: "於", 亏: "虧", 云: "雲",
    亚: "亞", 产: "產", 亩: "畝", 亲: "親", 亵: "褻", 亿: "億", 仅: "僅", 从: "從",
    仑: "侖", 仓: "倉", 仪: "儀", 们: "們", 优: "優", 会: "會", 传: "傳", 伤: "傷",
    伪: "偽", 体: "體", 余: "餘", 佣: "傭", 侠: "俠", 侣: "侶", 侥: "僥", 侦: "偵",
    侧: "側", 侨: "僑", 侩: "儈", 侪: "儕", 侬: "儂", 俣: "俁", 俦: "儔", 俨: "儼",
    俩: "倆", 俪: "儷", 俭: "儉", 债: "債", 倾: "傾", 偿: "償", 储: "儲", 儿: "兒",
    兑: "兌", 党: "黨", 兰: "蘭", 关: "關", 兴: "興", 兽: "獸", 内: "內", 冈: "岡",
    册: "冊", 写: "寫", 军: "軍", 农: "農", 冲: "衝", 决: "決", 况: "況", 冻: "凍",
    净: "淨", 准: "準", 凉: "涼", 减: "減", 凑: "湊", 凛: "凜", 凤: "鳳", 凭: "憑",
    凯: "凱", 击: "擊", 凿: "鑿", 划: "劃", 刘: "劉", 则: "則", 刚: "剛", 创: "創",
    删: "刪", 别: "別", 刬: "剗", 刭: "剄", 制: "製", 刹: "剎", 刽: "劊", 刿: "劌",
    剀: "剴", 剂: "劑", 剐: "剮", 剑: "劍", 剧: "劇", 劝: "勸", 办: "辦", 务: "務",
    动: "動", 励: "勵", 劲: "勁", 劳: "勞", 势: "勢", 勋: "勳", 勐: "猛", 勚: "勩",
    匀: "勻", 匦: "匭", 匮: "匱", 区: "區", 医: "醫", 华: "華", 协: "協", 单: "單",
    卖: "賣", 卢: "盧", 卤: "鹵", 卫: "衛", 却: "卻", 厂: "廠", 厅: "廳", 历: "歷",
    厉: "厲", 压: "壓", 厌: "厭", 厍: "厙", 厕: "廁", 厢: "廂", 厣: "厴", 县: "縣",
    参: "參", 双: "雙", 发: "發", 变: "變", 叙: "敘", 叶: "葉", 号: "號", 叹: "嘆",
    后: "後", 吓: "嚇", 吗: "嗎", 启: "啟", 吴: "吳", 员: "員", 呗: "唄", 呙: "咼",
    呛: "嗆", 呜: "嗚", 咏: "詠", 咙: "嚨", 咛: "嚀", 咝: "噝", 咨: "諮", 咸: "鹹",
    响: "響", 哑: "啞", 哒: "噠", 哓: "嘵", 哔: "嗶", 哕: "噦", 哗: "嘩", 哙: "噲",
    哜: "嚌", 哝: "噥", 哟: "喲", 唤: "喚", 唿: "呼", 啧: "嘖", 啬: "嗇", 啭: "囀",
    啮: "嚙", 啰: "囉", 啴: "嘽", 啸: "嘯", 喷: "噴", 喽: "嘍", 嗫: "囁", 嗳: "噯",
    嘘: "噓", 嘤: "嚶", 嘱: "囑", 噜: "嚕", 嚣: "囂", 团: "團", 园: "園", 围: "圍",
    国: "國", 图: "圖", 圆: "圓", 圣: "聖", 场: "場", 坏: "壞", 块: "塊", 坚: "堅",
    坛: "壇", 坜: "壢", 坝: "壩", 坞: "塢", 坟: "墳", 坠: "墜", 垄: "壟", 垅: "壟",
    垆: "壚", 垒: "壘", 垦: "墾", 垩: "堊", 垫: "墊", 垭: "埡", 垱: "壋", 垲: "塏",
    垴: "堖", 埘: "塒", 埙: "塤", 埚: "堝", 埯: "垵", 堑: "塹", 堕: "墮", 墙: "牆",
    壮: "壯", 声: "聲", 壳: "殼", 壶: "壺", 处: "處", 备: "備", 复: "復", 够: "夠",
    头: "頭", 夹: "夾", 夺: "奪", 奁: "奩", 奂: "奐", 奋: "奮", 奖: "獎", 奥: "奧",
    妆: "妝", 妇: "婦", 妈: "媽", 妩: "嫵", 妪: "嫗", 妫: "媯", 姗: "姍", 姹: "奼",
    娄: "婁", 娅: "婭", 娆: "嬈", 娇: "嬌", 娈: "孌", 娘: "孃", 娱: "娛", 娲: "媧",
    娴: "嫻", 婳: "嫿", 婴: "嬰", 婵: "嬋", 婶: "嬸", 媪: "媼", 嫒: "嬡", 嫔: "嬪",
    嫱: "嬙", 嬷: "嬤", 孙: "孫", 学: "學", 孪: "孿", 宝: "寶", 实: "實", 宠: "寵",
    审: "審", 宪: "憲", 宫: "宮", 宽: "寬", 宾: "賓", 寝: "寢", 对: "對", 寻: "尋",
    导: "導", 寿: "壽", 将: "將", 尔: "爾", 尘: "塵", 尝: "嘗", 尧: "堯", 尴: "尷",
    尽: "盡", 层: "層", 屉: "屜", 届: "屆", 属: "屬", 屡: "屢", 岁: "歲", 岂: "豈",
    岖: "嶇", 岗: "崗", 岘: "峴", 岚: "嵐", 岛: "島", 岭: "嶺", 岿: "巋", 峄: "嶧",
    峡: "峽", 峣: "嶢", 峤: "嶠", 峥: "崢", 峦: "巒", 崂: "嶗", 崃: "崍", 崄: "嶮",
    嵘: "嶸", 嵚: "嶔", 嵝: "嶁", 巅: "巔", 巩: "鞏", 巯: "巰", 币: "幣", 帅: "帥",
    师: "師", 帏: "幃", 帐: "帳", 帘: "簾", 帜: "幟", 带: "帶", 帧: "幀", 帮: "幫",
    帱: "幬", 帻: "幘", 帼: "幗", 幂: "冪", 并: "並", 广: "廣", 庄: "莊", 庆: "慶",
    庐: "廬", 庑: "廡", 库: "庫", 应: "應", 庙: "廟", 庞: "龐", 废: "廢", 开: "開",
    异: "異", 弃: "棄", 张: "張", 弥: "彌", 弪: "弳", 弯: "彎", 弹: "彈", 强: "強",
    归: "歸", 当: "當", 录: "錄", 彦: "彥", 彻: "徹", 征: "徵", 径: "徑", 徕: "徠",
    忆: "憶", 忏: "懺", 志: "誌", 忧: "憂", 忾: "愾", 怀: "懷", 态: "態", 怂: "慫",
    怜: "憐", 总: "總", 恋: "戀", 恳: "懇", 恶: "惡", 恸: "慟", 恹: "懨", 恺: "愷",
    恻: "惻", 恼: "惱", 恽: "惲", 悦: "悅", 悫: "愨", 悬: "懸", 悭: "慳", 悯: "憫",
    惊: "驚", 惧: "懼", 惨: "慘", 惩: "懲", 惫: "憊", 惬: "愜", 惭: "慚", 惮: "憚",
    惯: "慣", 愠: "慍", 愤: "憤", 愦: "憒", 愿: "願", 慑: "懾", 懑: "懣", 懒: "懶",
    戏: "戲", 战: "戰", 戬: "戩", 户: "戶", 扎: "紮", 扑: "撲", 执: "執", 扩: "擴",
    扪: "捫", 扫: "掃", 扬: "揚", 扰: "擾", 抚: "撫", 抛: "拋", 抟: "摶", 抠: "摳",
    抡: "掄", 抢: "搶", 护: "護", 报: "報", 担: "擔", 拟: "擬", 拢: "攏", 拣: "揀",
    拥: "擁", 拦: "攔", 拧: "擰", 拨: "撥", 择: "擇", 挂: "掛", 挚: "摯", 挛: "攣",
    挜: "掗", 挝: "撾", 挞: "撻", 挟: "挾", 挠: "撓", 挡: "擋", 挢: "撟", 挣: "掙",
    挤: "擠", 挥: "揮", 挦: "撏", 挨: "捱", 振: "振", 挺: "挺", 捝: "挩", 捞: "撈",
    损: "損", 捡: "撿", 换: "換", 捣: "搗", 据: "據", 掳: "擄", 掴: "摑", 掷: "擲",
    掸: "撣", 掺: "摻", 掼: "摜", 揽: "攬", 揿: "撳", 搀: "攙", 搁: "擱", 搂: "摟",
    搅: "攪", 携: "攜", 摄: "攝", 摅: "攄", 摆: "擺", 摇: "搖", 摈: "擯", 摊: "攤",
    撄: "攖", 撑: "撐", 撵: "攆", 撷: "擷",撸: "擼", 撺: "攛", 擞: "擻", 攒: "攢",
    敌: "敵", 敛: "斂", 数: "數", 斋: "齋", 斓: "斕", 斗: "鬥", 斩: "斬", 断: "斷",
    无: "無", 旧: "舊", 时: "時", 旷: "曠", 昙: "曇", 昼: "晝", 显: "顯", 晋: "晉",
    晒: "曬", 晓: "曉", 晔: "曄", 晕: "暈", 暂: "暫", 暧: "曖", 术: "術", 机: "機",
    杀: "殺", 杂: "雜", 权: "權", 条: "條", 来: "來", 杨: "楊", 杩: "榪", 杰: "傑",
    极: "極", 构: "構", 枞: "樅", 枢: "樞", 枣: "棗", 枥: "櫪", 枧: "梘", 枨: "棖",
    枪: "槍", 枫: "楓", 枭: "梟", 柜: "櫃", 柠: "檸", 柽: "檉", 栀: "梔", 栅: "柵",
    标: "標", 栈: "棧", 栉: "櫛", 栊: "櫳", 栋: "棟", 栌: "櫨", 栎: "櫟", 栏: "欄",
    树: "樹", 栖: "棲", 样: "樣", 栾: "欒", 桠: "椏", 桡: "橈", 桢: "楨", 档: "檔",
    桤: "榿", 桥: "橋", 桦: "樺", 桧: "檜", 桨: "槳", 桩: "樁", 梦: "夢", 梼: "檮",
    梾: "棶", 梿: "槤", 检: "檢", 棂: "欞", 椁: "槨", 椟: "櫝", 椠: "槧", 椤: "欏",
    椭: "橢", 楼: "樓", 榄: "欖", 榇: "櫬", 榈: "櫚", 榉: "櫸", 槚: "檟", 槛: "檻",
    槟: "檳", 槠: "櫧", 横: "橫", 樯: "檣", 樱: "櫻", 橥: "櫫", 橱: "櫥", 橹: "櫓",
    橼: "櫞", 欢: "歡", 欤: "歟", 欧: "歐", 歼: "殲", 殁: "歿", 殇: "殤", 残: "殘",
    殒: "殞", 殓: "殮", 殚: "殫", 殡: "殯", 殴: "毆", 毁: "毀", 毕: "畢", 毙: "斃",
    毡: "氈", 毵: "毿", 气: "氣", 氢: "氫", 氩: "氬", 氲: "氳", 汉: "漢", 汤: "湯",
    汹: "洶", 沟: "溝", 没: "沒", 沣: "灃", 沤: "漚", 沥: "瀝", 沦: "淪", 沧: "滄",
    沨: "渢", 沩: "溈", 沪: "滬", 泞: "濘", 泪: "淚", 泽: "澤", 泾: "涇", 洁: "潔",
    洒: "灑", 洼: "窪", 浃: "浹", 浅: "淺", 浆: "漿", 浇: "澆", 浈: "湞", 浊: "濁",
    测: "測", 济: "濟", 浏: "瀏", 浐: "滻", 浑: "渾", 浒: "滸", 浓: "濃", 浔: "潯",
    涛: "濤", 涝: "澇", 涞: "淶", 涟: "漣", 涠: "潿", 涡: "渦", 涢: "溳", 涣: "渙",
    涤: "滌", 润: "潤", 涧: "澗", 涨: "漲", 涩: "澀", 淀: "澱", 渊: "淵", 渌: "淥",
    渍: "漬", 渎: "瀆", 渐: "漸", 渑: "澠", 渔: "漁", 渖: "瀋", 渗: "滲", 温: "溫",
    湾: "灣", 湿: "濕", 溃: "潰", 溅: "濺", 滚: "滾", 滞: "滯", 滟: "灩", 滠: "灄",
    满: "滿", 滢: "瀅", 滤: "濾", 滥: "濫", 滦: "灤", 滨: "濱", 滩: "灘", 滪: "澦",
    漤: "灠", 潆: "瀠", 潇: "瀟", 潋: "瀲", 潍: "濰", 潜: "潛", 潴: "瀦", 澜: "瀾",
    濑: "瀨", 灏: "灝", 灭: "滅", 灯: "燈", 灵: "靈", 灾: "災", 灿: "燦", 炀: "煬",
    炉: "爐", 炖: "燉", 炜: "煒", 炝: "熗", 点: "點", 炼: "煉", 炽: "熾", 烁: "爍",
    烂: "爛", 烃: "烴", 烛: "燭", 烟: "煙", 烦: "煩", 烧: "燒", 烨: "燁", 烩: "燴",
    烫: "燙", 烬: "燼", 热: "熱", 焕: "煥", 焖: "燜", 焘: "燾", 爱: "愛", 爷: "爺",
    牍: "牘", 牦: "氂", 牵: "牽", 犊: "犢", 状: "狀", 犷: "獷", 犸: "獁", 犹: "猶",
    狈: "狽", 狝: "獮", 狞: "獰", 独: "獨", 狭: "狹", 狮: "獅", 狯: "獪", 狰: "猙",
    狱: "獄", 狲: "猻", 猃: "獫", 猎: "獵", 猕: "獼", 猡: "玀", 猪: "豬", 猫: "貓",
    猬: "蝟", 献: "獻", 玛: "瑪", 玮: "瑋", 环: "環", 现: "現", 玱: "瑲", 玺: "璽",
    珐: "琺", 珑: "瓏", 珰: "璫", 珲: "琿", 琏: "璉", 琐: "瑣", 琼: "瓊", 瑶: "瑤",
    瑷: "璦", 璎: "瓔", 瓒: "瓚", 瓯: "甌", 电: "電", 画: "畫", 畅: "暢", 畴: "疇",
    疖: "癤", 疗: "療", 疟: "瘧", 疠: "癘", 疡: "瘍", 疬: "癧", 疭: "瘲", 疮: "瘡",
    疯: "瘋", 疱: "皰", 痈: "癰", 痉: "痙", 痒: "癢", 痨: "癆", 痪: "瘓", 痫: "癇",
    瘅: "癉", 瘗: "瘞", 瘘: "瘻", 瘪: "癟", 瘫: "癱", 瘾: "癮", 瘿: "癭", 癞: "癩",
    皑: "皚", 皱: "皺", 皲: "皸", 盏: "盞", 盐: "鹽", 监: "監", 盖: "蓋", 盗: "盜",
    盘: "盤", 眍: "瞘", 眦: "眥", 眬: "矓", 着: "著", 睁: "睜", 睐: "睞", 瞒: "瞞",
    瞩: "矚", 矫: "矯", 矶: "磯", 矾: "礬", 矿: "礦", 砀: "碭", 码: "碼", 砖: "磚",
    砗: "硨", 砚: "硯", 砜: "碸", 砺: "礪", 砻: "礱", 砾: "礫", 础: "礎", 硁: "硜",
    硕: "碩", 硖: "硤", 硗: "磽", 硙: "磑", 硚: "礄", 确: "確", 碱: "鹼", 礼: "禮",
    祎: "禕", 祢: "禰", 祯: "禎", 祷: "禱", 祸: "禍", 禀: "稟", 禄: "祿", 禅: "禪",
    离: "離", 秃: "禿", 秆: "稈", 种: "種", 积: "積", 称: "稱", 秽: "穢", 税: "稅",
    稣: "穌", 稳: "穩", 穑: "穡", 穷: "窮", 窃: "竊", 窍: "竅", 窎: "窵", 窑: "窯",
    窜: "竄", 窝: "窩", 窥: "窺", 窦: "竇", 窭: "窶", 竖: "豎", 竞: "競", 笃: "篤",
    笋: "筍", 笔: "筆", 笕: "筧", 笺: "箋", 笼: "籠", 笾: "籩", 筚: "篳", 筛: "篩",
    筝: "箏", 筹: "籌", 签: "簽", 简: "簡", 箓: "籙", 箦: "簀", 箧: "篋", 箨: "籜",
    箩: "籮", 箪: "簞", 箫: "簫", 篑: "簣", 篓: "簍", 篮: "籃", 篱: "籬", 簖: "籪",
    籁: "籟", 籴: "糴", 类: "類", 籼: "秈", 粜: "糶", 粝: "糲", 粤: "粵", 粪: "糞",
    粮: "糧", 糁: "糝", 糇: "餱", 紧: "緊", 累: "累", 絷: "縶", 纟: "糹", 纠: "糾",
    纡: "紆", 红: "紅", 纣: "紂", 纤: "纖", 纥: "紇", 约: "約", 级: "級", 纨: "紈",
    纩: "纊", 纪: "紀", 纫: "紉", 纬: "緯", 纭: "紜", 纯: "純", 纰: "紕", 纱: "紗",
    纲: "綱", 纳: "納", 纵: "縱", 纶: "綸", 纷: "紛", 纸: "紙", 纹: "紋", 纺: "紡",
    纽: "紐", 纾: "紓", 线: "線", 绀: "紺", 绁: "紲", 绂: "紱", 练: "練", 组: "組",
    绅: "紳", 细: "細", 织: "織", 终: "終", 绉: "縐", 绊: "絆", 绋: "紼", 绌: "絀",
    绍: "紹", 绎: "繹", 经: "經", 绐: "紿", 绑: "綁", 绒: "絨", 结: "結", 绔: "絝",
    绕: "繞", 绖: "絰", 绗: "絎", 绘: "繪", 给: "給", 绚: "絢", 绛: "絳", 络: "絡",
    绝: "絕", 绞: "絞", 统: "統", 绠: "綆", 绡: "綃", 绢: "絹", 绣: "繡", 绥: "綏",
    绦: "絛", 继: "繼", 绩: "績", 绪: "緒", 绫: "綾", 续: "續", 绮: "綺", 绯: "緋",
    维: "維", 绵: "綿", 绶: "綬", 绷: "繃", 绸: "綢", 绺: "綹", 绻: "綣", 综: "綜",
    绽: "綻", 绾: "綰", 绿: "綠", 缀: "綴", 缁: "緇", 缂: "緙", 缃: "緗", 缄: "緘",
    缅: "緬", 缆: "纜", 缇: "緹", 缈: "緲", 缉: "緝", 缋: "繢", 缌: "緦", 缍: "綞",
    缎: "緞", 缏: "緶", 缑: "緱", 缒: "縋", 缓: "緩", 缔: "締", 缕: "縷", 编: "編",
    缗: "緡", 缘: "緣", 缙: "縉", 缚: "縛", 缛: "縟", 缜: "縝", 缝: "縫", 缟: "縞",
    缠: "纏", 缡: "縭", 缢: "縊", 缣: "縑", 缤: "繽", 缥: "縹", 缦: "縵", 缧: "縲",
    缨: "纓", 缩: "縮", 缪: "繆", 缫: "繅", 缬: "纈", 缭: "繚", 缮: "繕", 缯: "繒",
    缰: "韁", 缱: "繾", 缲: "繰", 缳: "繯", 缴: "繳", 缵: "纘", 罂: "罌", 网: "網",
    罗: "羅", 罚: "罰", 罢: "罷", 罴: "羆", 羁: "羈", 羟: "羥", 羡: "羨", 翘: "翹",
    耸: "聳", 耻: "恥", 聂: "聶", 聋: "聾", 职: "職", 联: "聯", 聩: "聵", 聪: "聰",
    肃: "肅", 肠: "腸", 肤: "膚", 肮: "骯", 肴: "餚", 胁: "脅", 胜: "勝", 胧: "朧",
    胨: "腖", 胪: "臚", 胫: "脛", 胶: "膠", 脉: "脈", 脍: "膾", 脏: "髒", 脐: "臍",
    脑: "腦", 脓: "膿", 脔: "臠", 脚: "腳", 脱: "脫", 脶: "腡", 脸: "臉", 腊: "臘",
    腘: "膕", 腭: "顎", 腻: "膩", 腼: "靦", 腾: "騰", 舆: "輿", 舣: "艤", 舰: "艦",
    舱: "艙", 艰: "艱", 艳: "艷", 艺: "藝", 节: "節", 芈: "羋", 芗: "薌", 芜: "蕪",
    芦: "蘆", 芸: "蕓", 苁: "蓯", 苇: "葦", 苈: "藶", 苋: "莧", 苌: "萇", 苍: "蒼",
    苎: "苧", 苏: "蘇", 苹: "蘋", 茎: "莖", 茏: "蘢", 茑: "蔦", 茔: "塋", 茕: "煢",
    茧: "繭", 荆: "荊", 荐: "薦", 荙: "薘", 荚: "莢", 荛: "蕘", 荜: "蓽", 荞: "蕎",
    荟: "薈", 荠: "薺", 荡: "蕩", 荣: "榮", 荤: "葷", 荥: "滎", 荦: "犖", 荧: "熒",
    荨: "蕁", 荩: "藎", 荪: "蓀", 荫: "蔭", 药: "藥", 莅: "蒞", 莱: "萊", 莲: "蓮",
    莳: "蒔", 莴: "萵", 莶: "薟", 获: "獲", 莸: "蕕", 莹: "瑩", 莺: "鶯", 萝: "蘿",
    萤: "螢", 营: "營", 萦: "縈", 萧: "蕭", 萨: "薩", 葱: "蔥", 蒇: "蕆", 蒉: "蕢",
    蒋: "蔣", 蒌: "蔞", 蓝: "藍", 蓟: "薊", 蓠: "蘺", 蓣: "蕷", 蓥: "鎣", 蓦: "驀",
    蔂: "虆", 蔷: "薔", 蔹: "蘞", 蔺: "藺", 蕲: "蘄", 蕴: "蘊", 薮: "藪", 藓: "蘚",
    虏: "虜", 虑: "慮", 虚: "虛", 虫: "蟲", 虬: "虯", 虮: "蟣", 虽: "雖", 虾: "蝦",
    虿: "蠆", 蚀: "蝕", 蚁: "蟻", 蚂: "螞", 蚕: "蠶", 蚝: "蠔", 蛊: "蠱", 蛎: "蠣",
    蛏: "蟶", 蛮: "蠻", 蛰: "蟄", 蛱: "蛺", 蛲: "蟯", 蛳: "螄", 蛴: "蠐", 蜕: "蛻",
    蜗: "蝸", 蝇: "蠅", 蝈: "蟈", 蝉: "蟬", 蝼: "螻", 蝾: "蠑", 螀: "螿", 螨: "蟎",
    衅: "釁", 衔: "銜", 补: "補", 表: "表", 袄: "襖", 袅: "裊", 袜: "襪", 袭: "襲",
    装: "裝", 裆: "襠", 裈: "褌", 裢: "褳", 裣: "襝", 裤: "褲", 裥: "襇", 褛: "褸",
    褴: "襤", 见: "見", 观: "觀", 规: "規", 觅: "覓", 视: "視", 览: "覽", 觉: "覺",
    觊: "覬", 觋: "覡", 觌: "覿", 觎: "覦", 觏: "覯", 觐: "覲", 觑: "覷", 觞: "觴",
    触: "觸", 觯: "觶", 誉: "譽", 誊: "謄", 计: "計", 订: "訂", 讣: "訃", 认: "認",
    讥: "譏", 讦: "訐", 讨: "討", 让: "讓", 讪: "訕", 讫: "訖", 训: "訓", 议: "議",
    讯: "訊", 记: "記", 讲: "講", 讳: "諱", 讴: "謳", 讵: "詎", 讶: "訝", 讷: "訥",
    许: "許", 讹: "訛", 论: "論", 讼: "訟", 讽: "諷", 设: "設", 访: "訪", 诀: "訣",
    证: "證", 评: "評", 诅: "詛", 识: "識", 诈: "詐", 诉: "訴", 诊: "診", 诋: "詆",
    词: "詞", 诎: "詘", 译: "譯", 试: "試", 诗: "詩", 诚: "誠", 诛: "誅", 话: "話",
    诞: "誕", 诠: "詮", 诡: "詭", 询: "詢", 诣: "詣", 该: "該", 详: "詳", 诧: "詫",
    诨: "諢", 诩: "詡", 诫: "誡", 诬: "誣", 语: "語", 诮: "誚", 误: "誤", 诰: "誥",
    诱: "誘", 诲: "誨", 诳: "誑", 说: "說", 诵: "誦", 诶: "誒", 请: "請", 诸: "諸",
    诹: "諏", 诺: "諾", 读: "讀", 诼: "諑", 诽: "誹", 课: "課", 诿: "諉", 谀: "諛",
    谁: "誰", 谂: "諗", 调: "調", 谄: "諂", 谅: "諒", 谆: "諄", 谇: "誶", 谈: "談",
    谊: "誼", 谋: "謀", 谌: "諶", 谍: "諜", 谎: "謊", 谏: "諫", 谐: "諧", 谑: "謔",
    谒: "謁", 谓: "謂", 谔: "諤", 谕: "諭", 谖: "諼", 谗: "讒", 谘: "諮", 谙: "諳",
    谚: "諺", 谛: "諦", 谜: "謎", 谝: "諞", 谟: "謨", 谠: "讜", 谡: "謖", 谢: "謝",
    谣: "謠", 谤: "謗", 谥: "謚", 谦: "謙", 谧: "謐", 谨: "謹", 谩: "謾", 谪: "謫",
    谫: "譾", 谬: "謬", 谭: "譚", 谮: "譖", 谯: "譙", 谰: "讕", 谱: "譜", 谲: "譎",
    谳: "讞", 谴: "譴", 谵: "譫", 谶: "讖", 谷: "穀", 豁: "豁", 象: "象", 贝: "貝",
    贞: "貞", 负: "負", 贡: "貢", 财: "財", 责: "責", 贤: "賢", 败: "敗", 账: "賬",
    货: "貨", 质: "質", 贩: "販", 贪: "貪", 贫: "貧", 贬: "貶", 购: "購", 贮: "貯",
    贯: "貫", 贰: "貳", 贱: "賤", 贲: "賁", 贳: "貰", 贴: "貼", 贵: "貴", 贶: "貺",
    贷: "貸", 贸: "貿", 费: "費", 贺: "賀", 贻: "貽", 贼: "賊", 贽: "贄", 贾: "賈",
    贿: "賄", 赀: "貲", 赁: "賃", 赂: "賂", 赃: "贓", 资: "資", 赅: "賅", 赆: "贐",
    赇: "賕", 赈: "賑", 赉: "賚", 赊: "賒", 赋: "賦", 赌: "賭", 赍: "齎", 赎: "贖",
    赏: "賞", 赐: "賜", 赔: "賠", 赖: "賴", 赗: "賵", 赘: "贅", 赚: "賺", 赛: "賽",
    赞: "贊", 赠: "贈", 赡: "贍", 赢: "贏", 赣: "贛", 赵: "趙", 赶: "趕", 趋: "趨",
    趱: "趲", 跃: "躍", 跄: "蹌", 跖: "蹠", 跞: "躒", 践: "踐", 跷: "蹺", 跸: "蹕",
    跹: "躚", 跻: "躋", 踊: "踴", 踌: "躊", 踪: "蹤", 踬: "躓", 踯: "躑", 蹑: "躡",
    蹒: "蹣", 蹰: "躕", 蹿: "躥", 躏: "躪", 车: "車", 轧: "軋", 轨: "軌", 轩: "軒",
    转: "轉", 轮: "輪", 软: "軟", 轰: "轟", 轻: "輕", 轲: "軻", 轳: "轤", 轴: "軸",
    轵: "軹", 轶: "軼", 轷: "軤", 轸: "軫", 轹: "轢", 轺: "軺", 轼: "軾", 载: "載",
    轾: "輊", 轿: "轎", 辂: "輅", 较: "較", 辄: "輒", 辅: "輔", 辆: "輛", 辈: "輩",
    辉: "輝", 辊: "輥", 辋: "輞", 辍: "輟", 辎: "輜", 辏: "輳", 辐: "輻",辑: "輯",
    输: "輸", 辔: "轡", 辕: "轅",辖: "轄", 辗: "輾", 辘: "轆", 轙: "轙", 辞: "辭",
    辟: "闢", 辩: "辯", 辫: "辮", 边: "邊", 辽: "遼", 达: "達", 迁: "遷", 过: "過",
    迈: "邁", 运: "運", 还: "還", 这: "這", 进: "進", 远: "遠", 违: "違", 连: "連",
    迟: "遲", 迩: "邇", 迹: "跡", 适: "適", 选: "選", 逊: "遜", 递: "遞", 逻: "邏",
    遗: "遺", 遥: "遙", 邓: "鄧", 邝: "鄺", 邬: "鄔", 邮: "郵", 邹: "鄒", 邺: "鄴",
    邻: "鄰", 郁: "鬱", 郏: "郟", 郐: "鄶", 郑: "鄭", 郓: "鄆", 郦: "酈", 郧: "鄖",
    郸: "鄲", 酝: "醞", 酦: "醱", 酱: "醬", 酽: "釅", 酾: "釃", 酿: "釀", 释: "釋",
    里: "裡", 鉴: "鑒", 针: "針", 钉: "釘", 钊: "釗", 钋: "釙", 钌: "釕", 钍: "釷",
    钎: "釺", 钏: "釧", 钐: "釤", 钒: "釩", 钓: "釣", 钔: "鍆", 钕: "釹", 钗: "釵",
    钙: "鈣", 钚: "鈈", 钛: "鈦", 钝: "鈍", 钞: "鈔", 钟: "鐘", 钠: "鈉", 钡: "鋇",
    钢: "鋼", 钣: "鈑", 钤: "鈐", 钥: "鑰", 钦: "欽", 钧: "鈞", 钨: "鎢", 钩: "鉤",
    钪: "鈧", 钫: "鈁", 钬: "鈥", 钭: "鈄", 钮: "鈕", 钯: "鈀", 钰: "鈺", 钱: "錢",
    钲: "鉦", 钳: "鉗", 钴: "鈷", 钵: "缽", 钶: "鈳", 钷: "鉕", 钸: "鈽", 钹: "鈸",
    钺: "鉞", 钻: "鑽", 钼: "鉬", 钽: "鉭", 钾: "鉀", 铀: "鈾", 铁: "鐵", 铂: "鉑",
    铃: "鈴", 铄: "鑠", 铅: "鉛", 铆: "鉚", 铈: "鈰", 铉: "鉉", 铊: "鉈", 铋: "鉍",
    铌: "鈮", 铍: "鈹", 铎: "鐸", 铐: "銬", 铑: "銠", 铒: "鉺", 铕: "銪", 铖: "鋮",
    铗: "鋏", 铘: "鋣", 铙: "鐃", 铛: "鐺", 铜: "銅", 铝: "鋁", 铞: "銱", 铟: "銦",
    铠: "鎧", 铡: "鍘", 铢: "銖", 铣: "銑", 铤: "鋌", 铥: "銩", 铧: "鏵", 铨: "銓",
    铩: "鎩", 铪: "鉿", 铫: "銚", 铬: "鉻", 铭: "銘", 铮: "錚", 铯: "銫", 铰: "鉸",
    铱: "銥", 铲: "鏟", 铳: "銃", 铴: "鐋", 铵: "銨", 银: "銀", 铸: "鑄", 铹: "鐒",
    铺: "鋪", 铻: "鋙", 铼: "錸", 铽: "鋱", 链: "鏈", 铿: "鏗", 销: "銷", 锁: "鎖",
    锂: "鋰", 锃: "鋥", 锄: "鋤", 锅: "鍋", 锆: "鋯", 锇: "鋨", 锈: "鏽", 锉: "銼",
    锊: "鋝", 锋: "鋒", 锌: "鋅", 锍: "鋶", 锎: "鐦", 锏: "鐧", 锐: "銳", 锑: "銻",
    锒: "鋃", 锓: "鋟", 锔: "鋦", 锕: "錒", 锖: "錆", 锗: "鍺", 锘: "鍩", 错: "錯",
    锚: "錨", 锛: "錛", 锜: "錡", 锝: "鍀", 锞: "錁", 锟: "錕", 锡: "錫", 锢: "錮",
    锣: "鑼", 锤: "錘", 锥: "錐", 锦: "錦", 锨: "鍁", 锩: "錈", 锫: "錇", 锬: "錟",
    锭: "錠", 键: "鍵", 锯: "鋸", 锰: "錳", 锱: "錙", 锲: "鍥", 锴: "鍇", 锵: "鏘",
    锶: "鍶", 锷: "鍔", 锸: "鍤", 锹: "鍬", 锺: "鍾", 锻: "鍛", 锼: "鎪", 锾: "鍰",
    锿: "鎄", 镀: "鍍", 镁: "鎂", 镂: "鏤", 镄: "鐨", 镅: "鎇", 镆: "鏌", 镇: "鎮",
    镈: "鎛", 镉: "鎘", 镊: "鑷", 镌: "鐫", 镍: "鎳", 镏: "鎦", 镐: "鎬", 镑: "鎊",
    镒: "鎰", 镓: "鎵", 镔: "鑌", 镖: "鏢", 镗: "鏜", 镘: "鏝", 镙: "鏍", 镚: "鏰",
    镛: "鏞", 镜: "鏡", 镝: "鏑", 镞: "鏃", 镟: "鏇", 镠: "鏐", 镡: "鐔", 镢: "鐝",
    镣: "鐐", 镤: "鏷", 镥: "鑥", 镦: "鐓", 镧: "鑭", 镨: "鐠", 镩: "鑹", 镪: "鏹",
    镫: "鐙", 镬: "鑊", 镭: "鐳", 镯: "鐲", 镰: "鐮", 镱: "鐿", 镲: "鑔", 镳: "鑣",
    门: "門", 闩: "閂", 闪: "閃", 闫: "閆", 闭: "閉", 问: "問", 闯: "闖", 闰: "閏",
    闱: "闈", 闲: "閒", 闳: "閎", 间: "間", 闵: "閔", 闶: "閌", 闷: "悶", 闸: "閘",
    闹: "鬧", 闺: "閨", 闻: "聞", 闼: "闥", 闽: "閩", 闾: "閭", 阀: "閥", 阁: "閣",
    阂: "閡", 阃: "閫", 阄: "鬮", 阅: "閱", 阆: "閬", 阈: "閾", 阉: "閹", 阊: "閶",
    阋: "鬩", 阌: "閿", 阍: "閽", 阎: "閻", 阏: "閼", 阐: "闡", 阑: "闌", 阒: "闃",
    阔: "闊", 阕: "闋", 阖: "闔", 阗: "闐", 阙: "闕", 阚: "闞", 队: "隊", 阳: "陽",
    阴: "陰", 阵: "陣", 阶: "階", 际: "際", 陆: "陸", 陇: "隴", 陈: "陳", 陉: "陘",
    陕: "陝", 陧: "隉", 陨: "隕", 险: "險", 随: "隨", 隐: "隱", 隶: "隸", 难: "難",
    雏: "雛", 雳: "靂", 雾: "霧", 霁: "霽", 霉: "黴", 靓: "靚", 静: "靜", 面: "麵",
    韦: "韋", 韧: "韌", 韩: "韓", 韪: "韙", 韫: "韞", 韬: "韜", 韵: "韻", 页: "頁",
    顶: "頂", 顷: "頃", 项: "項", 顺: "順", 须: "須", 顽: "頑", 顾: "顧", 顿: "頓",
    颀: "頎", 颁: "頒", 颂: "頌", 预: "預", 颅: "顱", 领: "領", 颇: "頗", 颈: "頸",
    颉: "頡", 颊: "頰", 颌: "頜", 颍: "潁", 颎: "熲", 颏: "頦", 频: "頻", 颓: "頹",
    颜: "顏", 额: "額", 颞: "顳", 颟: "顢", 颠: "顛", 颡: "顙", 颢: "顥", 颤: "顫",
    风: "風", 飘: "飄", 飞: "飛", 饥: "飢", 饨: "飩", 饩: "餼", 饪: "飪", 饫: "飫",
    饬: "飭", 饭: "飯", 饮: "飲", 饯: "餞", 饰: "飾", 饱: "飽", 饲: "飼", 饴: "飴",
    饵: "餌", 饶: "饒", 饷: "餉", 饺: "餃", 饼: "餅", 饽: "餑", 饿: "餓", 馀: "餘",
    馁: "餒", 馄: "餛", 馅: "餡", 馆: "館", 馈: "饋", 馊: "餿", 馋: "饞", 馍: "饃",
    馏: "餾", 馐: "饈", 馑: "饉", 馒: "饅", 马: "馬", 驭: "馭", 驮: "馱", 驯: "馴",
    驰: "馳", 驱: "驅", 驳: "駁", 驴: "驢", 驵: "駔", 驶: "駛", 驷: "駟", 驸: "駙",
    驹: "駒", 驺: "騶", 驻: "駐", 驼: "駝", 驽: "駑", 驾: "駕", 驿: "驛", 骀: "駘",
    骁: "驍", 骂: "罵", 骄: "驕", 骅: "驊", 骆: "駱", 骇: "駭", 骈: "駢", 骊: "驪",
    骋: "騁", 验: "驗", 骏: "駿", 骐: "騏", 骑: "騎", 骒: "騍", 骓: "騅", 骖: "驂",
    骗: "騙", 骘: "騭", 骛: "騖", 骜: "驁", 骝: "騮", 骟: "騸", 骠: "驃", 骡: "騾",
    骢: "驄", 骣: "驏", 骤: "驟", 骥: "驥", 骧: "驤", 髅: "髏", 髋: "髖", 髌: "髕",
    魇: "魘", 魉: "魎", 魏: "魏", 鱼: "魚", 鲁: "魯", 鲂: "魴", 鲅: "鮁", 鲆: "鮃",
    鲇: "鯰", 鲈: "鱸", 鲋: "鮒", 鲍: "鮑", 鲎: "鱟", 鲐: "鮐", 鲑: "鮭", 鲒: "鮚",
    鲔: "鮪", 鲕: "鮞", 鲚: "鱭", 鲛: "鮫", 鲜: "鮮", 鲞: "鯗", 鲟: "鱘", 鲠: "鯁",
    鲡: "鱺", 鲢: "鰱", 鲣: "鰹", 鲤: "鯉", 鲥: "鰣", 鲦: "鰷", 鲧: "鯀", 鲨: "鯊",
    鲩: "鯇", 鲫: "鯽", 鲭: "鯖", 鲮: "鯪", 鲰: "鯫", 鲱: "鯡", 鲲: "鯤", 鲳: "鯧",
    鲴: "鯝", 鲵: "鯢", 鲶: "鯰", 鲷: "鯛", 鲸: "鯨", 鲻: "鯔", 鲼: "鱝", 鲽: "鰈",
    鳄: "鱷", 鳅: "鰍", 鳆: "鰒", 鳇: "鰉", 鳌: "鰲", 鳍: "鰭", 鳎: "鰨", 鳏: "鰥",
    鳐: "鰩", 鳓: "鰳", 鳔: "鰾", 鳕: "鱈", 鳖: "鱉", 鳗: "鰻", 鳘: "鰵", 鳙: "鱅",
    鳜: "鱖", 鳝: "鱔", 鳞: "鱗", 鸟: "鳥", 鸠: "鳩", 鸡: "雞", 鸢: "鳶", 鸣: "鳴",
    鸥: "鷗", 鸦: "鴉", 鸨: "鴇", 鸩: "鴆", 鸪: "鴣", 鸫: "鶇", 鸬: "鸕", 鸭: "鴨",
    鸯: "鴦", 鸱: "鴟", 鸲: "鴝", 鸳: "鴛", 鸵: "鴕", 鸶: "鷥", 鸷: "鷙", 鸸: "鴯",
    鸹: "鴰", 鸺: "鵂", 鸻: "鴴", 鸼: "鵃", 鸽: "鴿", 鸾: "鸞", 鹀: "鵐", 鹁: "鵓",
    鹂: "鸝", 鹃: "鵑", 鹄: "鵠", 鹅: "鵝", 鹆: "鵒", 鹇: "鷳", 鹈: "鵜", 鹉: "鵡",
    鹊: "鵲", 鹋: "鶓", 鹌: "鵪", 鹍: "鵾", 鹎: "鵯", 鹏: "鵬", 鹐: "鵮", 鹑: "鶉",
    鹒: "鶊", 鹓: "鵷", 鹔: "鷫", 鹕: "鶘", 鹖: "鶡", 鹗: "鶚", 鹘: "鶻", 鹙: "鶖",
    鹚: "鶿", 鹛: "鶥", 鹜: "鶩", 鹞: "鷂", 鹟: "鶲", 鹠: "鶹", 鹡: "鶺", 鹢: "鷁",
    鹣: "鶼", 鹤: "鶴", 鹦: "鸚", 鹧: "鷓", 鹨: "鷚", 鹩: "鷯", 鹪: "鷦", 鹫: "鷲",
    鹬: "鷸", 鹭: "鷺", 鹰: "鷹", 鹱: "鸌", 鹳: "鸛", 鹾: "鹺", 麦: "麥", 黄: "黃",
    黉: "黌", 黡: "黶", 黩: "黷", 黪: "黲", 黾: "黽", 鼋: "黿", 鼍: "鼉", 鼹: "鼴",
    齐: "齊", 齑: "齏", 齿: "齒", 龄: "齡", 龅: "齙", 龆: "齠", 龇: "齜", 龈: "齦",
    龉: "齬", 龊: "齪", 龙: "龍", 龚: "龔", 龛: "龕", 龟: "龜"
  };
  return Array.from(converted, (char) => char.charCodeAt(0) > 127 ? charMap[char] ?? char : char)
    .join("")
    .replaceAll("限製", "限制")
    .replaceAll("管製", "管制")
    .replaceAll("製裁", "制裁")
    .replaceAll("製度", "制度")
    .replaceAll("機製", "機制")
    .replaceAll("重復", "重複");
}

function Notice({ tone, text, action, copy }: { tone: "info" | "warn" | "error"; text: string; action?: () => void; copy?: DashboardCopy }) {
  return (
    <div className={`notice ${tone}`}>
      <span>{text}</span>
      {action ? (
        <button type="button" onClick={action}>
          {copy?.notices.retry ?? "重试"}
        </button>
      ) : null}
    </div>
  );
}

function Skeleton({ copy }: { copy: DashboardCopy }) {
  return (
    <div className="skeleton-grid" aria-label={copy.explanation.loading}>
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

function dailyDelta(
  payload: { trend: readonly FeaturedTrendPoint[] } | null,
  copy: DashboardCopy
): { label: string; shortLabel: string; kind: "up" | "down" | "flat" } {
  const trend = payload?.trend ?? [];
  if (trend.length < 2) {
    return { label: copy.dailyDelta.empty, shortLabel: "--", kind: "flat" };
  }
  const latest = trend[trend.length - 1].relationship_temperature;
  const previous = trend[trend.length - 2].relationship_temperature;
  const delta = latest - previous;
  if (Math.abs(delta) < 0.05) {
    const shortLabel = copy.dailyDelta.flat.replace(copy.dailyDelta.prefix, "");
    return { label: copy.dailyDelta.flat, shortLabel, kind: "flat" };
  }
  const shortLabel = `${delta > 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(1)}`;
  return {
    label: `${copy.dailyDelta.prefix}${shortLabel}`,
    shortLabel,
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

function compactDateRange(startDate: string, endDate: string, copy: DashboardCopy): string {
  return copy.dates.range(startDate, endDate);
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

function reportTitle(report: TurningPoint["reports"][number], locale: Locale, copy: DashboardCopy): string {
  const titleSources = locale === "zh-CN" || locale === "zh-TW"
    ? [report.chinese_title, report.resolved_title, report.url_title]
    : [report.resolved_title, report.url_title, report.chinese_title];
  const candidates = titleSources
    .map(cleanReportText)
    .filter((title): title is string => title !== null && isReadableReportTitle(title, report.source_domain));
  return candidates[0] ?? copy.report.fallbackTitle(cleanDomain(report.source_domain, copy));
}

function reportSummary(report: TurningPoint["reports"][number], locale: Locale): string | null {
  const summarySources = locale === "zh-CN" || locale === "zh-TW"
    ? [report.chinese_summary, report.short_summary, report.meta_description]
    : [report.short_summary, report.meta_description, report.chinese_summary];
  const candidates = summarySources
    .map(cleanReportText)
    .filter((summary): summary is string => summary !== null && isReadableReportSummary(summary));
  return candidates[0] ? relationshipIndexCopy(candidates[0]) : null;
}

function uniqueReports(reports: TurningPoint["reports"], locale: Locale, copy: DashboardCopy): TurningPoint["reports"] {
  const seen = new Set<string>();
  const unique: TurningPoint["reports"] = [];
  for (const report of reports) {
    const title = reportTitle(report, locale, copy).replace(/（重复）$/, "").trim().toLowerCase();
    const key = `${cleanDomain(report.source_domain, copy).toLowerCase()}|${title}`;
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
  state: { hasAiSummary: boolean; aiPending: boolean; aiMessage: string | null },
  copy: DashboardCopy
): { text: string; tone: "muted" | "warn" } | null {
  if (state.hasAiSummary || state.aiPending) {
    return null;
  }
  if (state.aiMessage) {
    return { text: state.aiMessage, tone: "warn" };
  }
  const aiStatus = turningPoint.ai_status ?? "not_requested";
  if (aiStatus === "missing_key") {
    return { text: copy.explanation.aiMissingKey, tone: "warn" };
  }
  if (aiStatus === "error") {
    return { text: copy.explanation.aiError, tone: "warn" };
  }
  if (aiStatus === "not_requested" || aiStatus === "pending") {
    return { text: copy.explanation.aiNotReady, tone: "muted" };
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

function cleanDomain(sourceDomain: string, copy?: DashboardCopy): string {
  return sourceDomain.replace(/^www\./, "").replace(/:443$/, "") || (copy?.report.sourceFallback ?? "来源网站");
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
