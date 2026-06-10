"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { localeMeta, type DashboardCopy, type Locale } from "@/lib/i18n";

type HeaderTab = "dashboard" | "methodology";
type SiteHeaderCopy = Pick<DashboardCopy, "topbar" | "nav">;

interface LanguageOption {
  locale: Locale;
  href: string;
}

interface SiteHeaderProps {
  activeTab: HeaderTab;
  copy: SiteHeaderCopy;
  dashboardHref: string;
  languageOptions: LanguageOption[];
  latestData: string | null;
  locale: Locale;
  methodologyHref: string;
}

export default function SiteHeader({
  activeTab,
  copy,
  dashboardHref,
  languageOptions,
  latestData,
  locale,
  methodologyHref
}: SiteHeaderProps) {
  const [headerActionsOpen, setHeaderActionsOpen] = useState(false);
  const [wechatOpen, setWechatOpen] = useState(false);
  const wechatCloseButtonRef = useRef<HTMLButtonElement | null>(null);

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

  return (
    <>
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
              {latestData ? <time dateTime={latestData}>{latestData}</time> : <span>{copy.topbar.waitingCache}</span>}
            </aside>
          </div>
        </div>
      </header>

      <nav className="site-tabs" aria-label={copy.nav.aria}>
        <a className={`site-tab${activeTab === "dashboard" ? " is-active" : ""}`} href={dashboardHref} aria-current={activeTab === "dashboard" ? "page" : undefined}>
          {copy.nav.dashboard}
        </a>
        <a
          className={`site-tab${activeTab === "methodology" ? " is-active" : ""}`}
          href={methodologyHref}
          aria-current={activeTab === "methodology" ? "page" : undefined}
        >
          {copy.nav.methodology}
        </a>
      </nav>

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
    </>
  );
}
