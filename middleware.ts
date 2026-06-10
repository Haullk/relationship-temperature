import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, localeFromPathname, type Locale } from "@/lib/i18n";

export function middleware(request: NextRequest) {
  const detectedLocale = localeRedirectTarget(request);
  if (detectedLocale !== null) {
    const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, publicOriginFromHeaders(request.headers, request.nextUrl));
    redirectUrl.pathname = `/${detectedLocale}`;
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Vary", appendVary(response.headers.get("Vary"), "Accept-Language"));
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-geoprizm-locale", localeFromPathname(request.nextUrl.pathname));
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|ads.txt|.*\\..*).*)"]
};

function localeRedirectTarget(request: NextRequest): Locale | null {
  if (!shouldAutoDetectLocale(request)) {
    return null;
  }
  const detectedLocale = preferredLocaleFromAcceptLanguage(request.headers.get("accept-language"));
  return detectedLocale !== null && detectedLocale !== defaultLocale ? detectedLocale : null;
}

function shouldAutoDetectLocale(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  if (request.nextUrl.pathname !== "/") {
    return false;
  }
  if (request.nextUrl.searchParams.get("lang") === defaultLocale || request.nextUrl.searchParams.get("locale") === defaultLocale) {
    return false;
  }
  if (request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch") {
    return false;
  }
  return !isCrawler(request.headers.get("user-agent"));
}

export function preferredLocaleFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) {
    return null;
  }
  const candidates = header
    .split(",")
    .map((part, index) => {
      const [rawLanguage, ...params] = part.trim().split(";");
      const qValue = params.find((param) => param.trim().startsWith("q="))?.split("=")[1];
      const q = qValue ? Number.parseFloat(qValue) : 1;
      return {
        language: rawLanguage.trim().toLowerCase(),
        q: Number.isFinite(q) ? q : 0,
        index
      };
    })
    .filter((candidate) => candidate.language.length > 0 && candidate.q > 0)
    .sort((left, right) => right.q - left.q || left.index - right.index);

  for (const candidate of candidates) {
    const locale = localeFromLanguageTag(candidate.language);
    if (locale !== null) {
      return locale;
    }
  }
  return null;
}

export function localeFromLanguageTag(language: string): Locale | null {
  if (language === "*" || language.startsWith("zh-hans") || language === "zh" || language.startsWith("zh-cn") || language.startsWith("zh-sg")) {
    return "zh-CN";
  }
  if (language.startsWith("zh-hant") || language.startsWith("zh-tw") || language.startsWith("zh-hk") || language.startsWith("zh-mo")) {
    return "zh-TW";
  }
  if (language.startsWith("en")) {
    return "en";
  }
  if (language.startsWith("ja")) {
    return "ja";
  }
  if (language.startsWith("ko")) {
    return "ko";
  }
  return null;
}

export function isCrawler(userAgent: string | null): boolean {
  return /bot|crawler|spider|crawling|googlebot|google-inspectiontool|mediapartners-google|google-display-ads-bot|adsbot-google|bingbot|duckduckbot|baiduspider|yandexbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp/i.test(userAgent ?? "");
}

export function appendVary(current: string | null, value: string): string {
  if (!current) {
    return value;
  }
  const fields = current.split(",").map((field) => field.trim().toLowerCase());
  return fields.includes(value.toLowerCase()) ? current : `${current}, ${value}`;
}

export function publicOriginFromHeaders(headers: Headers, fallbackUrl: Pick<URL, "host" | "protocol">): string {
  const host = firstHeaderValue(headers.get("host")) ?? firstHeaderValue(headers.get("x-forwarded-host")) ?? fallbackUrl.host;
  const protocol = firstHeaderValue(headers.get("x-forwarded-proto")) ?? fallbackUrl.protocol.replace(/:$/, "");
  return `${protocol}://${host}`;
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first || /[\s/\\]/.test(first)) {
    return null;
  }
  return first;
}
