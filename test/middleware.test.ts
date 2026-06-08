import { describe, expect, it } from "vitest";

import { appendVary, isCrawler, localeFromLanguageTag, preferredLocaleFromAcceptLanguage } from "../middleware";

describe("locale middleware helpers", () => {
  it("maps browser language tags to supported locales", () => {
    expect(localeFromLanguageTag("zh-hans-cn")).toBe("zh-CN");
    expect(localeFromLanguageTag("zh-hant-hk")).toBe("zh-TW");
    expect(localeFromLanguageTag("en-us")).toBe("en");
    expect(localeFromLanguageTag("ja-jp")).toBe("ja");
    expect(localeFromLanguageTag("ko-kr")).toBe("ko");
    expect(localeFromLanguageTag("fr-fr")).toBeNull();
  });

  it("chooses the highest priority supported Accept-Language locale", () => {
    expect(preferredLocaleFromAcceptLanguage("fr-CA, ko;q=0.9, en;q=0.8")).toBe("ko");
    expect(preferredLocaleFromAcceptLanguage("en-US;q=0.4, zh-Hant-HK;q=0.9")).toBe("zh-TW");
    expect(preferredLocaleFromAcceptLanguage("de, fr;q=0")).toBeNull();
  });

  it("detects crawlers so SEO bots are not auto-redirected by language", () => {
    expect(isCrawler("Mozilla/5.0 compatible Googlebot/2.1")).toBe(true);
    expect(isCrawler("Mozilla/5.0 Safari/605.1.15")).toBe(false);
  });

  it("appends Vary headers without duplicating fields", () => {
    expect(appendVary(null, "Accept-Language")).toBe("Accept-Language");
    expect(appendVary("RSC, Accept-Language", "Accept-Language")).toBe("RSC, Accept-Language");
    expect(appendVary("RSC", "Accept-Language")).toBe("RSC, Accept-Language");
  });
});
