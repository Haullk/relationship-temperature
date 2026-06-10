import { siteUrl } from "./i18n";

export const brandName = "GeoPrizm";
export const canonicalSiteUrl = siteUrl;
export const aboutUrl = `${siteUrl}/about`;
export const contactEmail = "helioshulk@gmail.com";
export const githubUrl = "https://github.com/Haullk/relationship-temperature";
export const docsUrl = "https://haullk.github.io/relationship-temperature/";
export const productHuntUrl = "https://www.producthunt.com/products/geoprizm";
export const logoUrl = `${siteUrl}/logo.png`;

const brandDescription =
  "GeoPrizm is a free, open-source data dashboard that tracks bilateral relations through GDELT global news event signals, 0-100 relationship indexes, trend charts, and AI-assisted explanations.";

const sameAs = [githubUrl, docsUrl, productHuntUrl];

export function buildSiteJsonLd(inLanguage: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: brandName,
        url: siteUrl,
        logo: logoUrl,
        image: logoUrl,
        description: brandDescription,
        foundingDate: "2026",
        founder: {
          "@type": "Person",
          name: "Haullk",
          url: "https://github.com/Haullk"
        },
        email: `mailto:${contactEmail}`,
        sameAs,
        knowsAbout: [
          "GDELT",
          "CAMEO event data",
          "GoldsteinScale",
          "bilateral relations",
          "geopolitical news signals",
          "relationship indexes"
        ],
        mainEntityOfPage: {
          "@id": `${aboutUrl}#webpage`
        }
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: brandName,
        url: siteUrl,
        description: brandDescription,
        inLanguage,
        publisher: {
          "@id": `${siteUrl}/#organization`
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: brandName,
        url: siteUrl,
        image: logoUrl,
        description: brandDescription,
        applicationCategory: "ResearchApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        author: {
          "@id": `${siteUrl}/#organization`
        },
        publisher: {
          "@id": `${siteUrl}/#organization`
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock"
        },
        isBasedOn: {
          "@type": "CreativeWork",
          name: "GDELT 2.0 Event Database",
          url: "https://www.gdeltproject.org/"
        },
        sameAs
      }
    ]
  };
}

export function buildAboutJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${aboutUrl}#webpage`,
        url: aboutUrl,
        name: "About GeoPrizm",
        description:
          "GeoPrizm is a free, open-source bilateral relations dashboard maintained by Haullk and built on public GDELT news event data.",
        inLanguage: "zh-CN",
        isPartOf: {
          "@id": `${siteUrl}/#website`
        },
        mainEntity: {
          "@id": `${siteUrl}/#organization`
        },
        about: {
          "@id": `${siteUrl}/#software`
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${aboutUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: brandName,
            item: siteUrl
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "About",
            item: aboutUrl
          }
        ]
      }
    ]
  };
}
