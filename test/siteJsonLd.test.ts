import { describe, expect, it } from "vitest";

import { buildHomeJsonLd } from "../lib/homeSeo";
import { buildAboutJsonLd, buildSiteJsonLd } from "../lib/siteJsonLd";

describe("site JSON-LD", () => {
  it("describes GeoPrizm as a consistent brand entity", () => {
    const jsonLd = buildSiteJsonLd("zh-CN");
    const graph = jsonLd["@graph"];
    const organization = graph.find((node) => node["@type"] === "Organization");
    const software = graph.find((node) => node["@type"] === "SoftwareApplication");

    expect(organization).toMatchObject({
      "@id": "https://www.geoprizm.com/#organization",
      name: "GeoPrizm",
      url: "https://www.geoprizm.com",
      logo: "https://www.geoprizm.com/logo.png",
      foundingDate: "2026",
      email: "mailto:helioshulk@gmail.com"
    });
    expect(organization?.sameAs).toContain("https://github.com/Haullk/relationship-temperature");
    expect(organization?.sameAs).toContain("https://www.producthunt.com/products/geoprizm");
    expect(software).toMatchObject({
      "@id": "https://www.geoprizm.com/#software",
      name: "GeoPrizm",
      operatingSystem: "Web",
      isAccessibleForFree: true
    });
  });

  it("links the about page to the organization entity", () => {
    const jsonLd = buildAboutJsonLd();
    const aboutPage = jsonLd["@graph"].find((node) => node["@type"] === "AboutPage");

    expect(aboutPage).toMatchObject({
      "@id": "https://www.geoprizm.com/about#webpage",
      mainEntity: {
        "@id": "https://www.geoprizm.com/#organization"
      },
      about: {
        "@id": "https://www.geoprizm.com/#software"
      }
    });
  });

  it("adds homepage FAQ and citation schema for AI answer engines", () => {
    const jsonLd = buildHomeJsonLd("en");
    const faqPage = jsonLd["@graph"].find((node) => node["@type"] === "FAQPage");
    const webPage = jsonLd["@graph"].find((node) => node["@type"] === "WebPage");

    expect(webPage).toMatchObject({
      "@id": "https://www.geoprizm.com/en#webpage",
      mainEntity: {
        "@id": "https://www.geoprizm.com/#software"
      }
    });
    expect(webPage?.citation).toContain("https://www.gdeltproject.org/");
    expect(Array.isArray(faqPage?.mainEntity)).toBe(true);
    const questions = Array.isArray(faqPage?.mainEntity) ? faqPage.mainEntity : [];
    expect(questions).toHaveLength(4);
    expect(questions[0]).toMatchObject({
      "@type": "Question",
      name: "What is GeoPrizm?"
    });
  });
});
