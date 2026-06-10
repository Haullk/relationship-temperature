import { describe, expect, it } from "vitest";

import {
  changeDirectionLabel,
  defaultLocale,
  languageAlternates,
  localeFromPathname,
  localeFromSegment,
  localizedPath,
  localizedSwitchPath,
  localizedUrl,
  pairLocalizedName,
  relationshipStatusLabel
} from "../lib/i18n";

describe("i18n helpers", () => {
  it("detects locales from path segments and defaults unprefixed routes", () => {
    expect(localeFromSegment("zh-TW")).toBe("zh-TW");
    expect(localeFromSegment("zh%2DTW")).toBe("zh-TW");
    expect(localeFromSegment("fr")).toBeNull();
    expect(localeFromPathname("/en/bilateral/china-united-states")).toBe("en");
    expect(localeFromPathname("/bilateral/china-united-states")).toBe(defaultLocale);
  });

  it("builds localized paths without prefixing the default locale", () => {
    expect(localizedPath("zh-CN", "/bilateral/china-united-states")).toBe("/bilateral/china-united-states");
    expect(localizedPath("en", "/bilateral/china-united-states")).toBe("/en/bilateral/china-united-states");
    expect(localizedUrl("ja", "/")).toBe("https://www.geoprizm.com/ja");
  });

  it("marks explicit default-locale switch links so browser language detection does not override them", () => {
    expect(localizedSwitchPath("zh-CN", "/")).toBe("/?lang=zh-CN");
    expect(localizedSwitchPath("zh-CN", "/bilateral/china-united-states")).toBe("/bilateral/china-united-states?lang=zh-CN");
    expect(localizedSwitchPath("en", "/bilateral/china-united-states")).toBe("/en/bilateral/china-united-states");
  });

  it("builds hreflang alternates for all supported locales", () => {
    const alternates = languageAlternates("/bilateral/china-united-states");

    expect(alternates["zh-CN"]).toBe("https://www.geoprizm.com/bilateral/china-united-states");
    expect(alternates.en).toBe("https://www.geoprizm.com/en/bilateral/china-united-states");
    expect(alternates["zh-TW"]).toBe("https://www.geoprizm.com/zh-TW/bilateral/china-united-states");
    expect(alternates["x-default"]).toBe(alternates["zh-CN"]);
  });

  it("localizes pair names, status labels, and change labels", () => {
    expect(pairLocalizedName("en", "chn_usa")).toBe("China-United States");
    expect(pairLocalizedName("ko", "chn_usa")).toBe("중국 / 미국");
    expect(relationshipStatusLabel("en", 60.8)).toBe("Leaning friendly");
    expect(relationshipStatusLabel("zh-TW", 41.2)).toBe("偏緊張");
    expect(changeDirectionLabel("ja", "恶化")).toBe("悪化");
  });
});
