import { localeMeta } from "./i18n";
import type { PairSeoSummary } from "./pairSeo";
import type { RelationshipPayload } from "./types";

export function buildPairJsonLd(summary: PairSeoSummary, relationship: RelationshipPayload | null) {
  const dateModified = summary.generatedAt ?? summary.dataEnd ?? undefined;
  const temporalCoverage = summary.dataStart && summary.dataEnd ? `${summary.dataStart}/${summary.dataEnd}` : undefined;
  const inLanguage = localeMeta[summary.locale].htmlLang;
  const variableMeasured = [
    {
      "@type": "PropertyValue",
      name: "relationship_index",
      description: "0-100 relationship index derived from GDELT event signals",
      value: summary.currentTemperature ?? undefined,
      unitText: "index"
    },
    {
      "@type": "PropertyValue",
      name: "turning_points",
      description: "Detected trend turning points in the selected relationship window",
      value: relationship?.turning_points.length ?? undefined
    }
  ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${summary.canonicalUrl}#webpage`,
        url: summary.canonicalUrl,
        name: summary.title,
        description: summary.description,
        inLanguage,
        isPartOf: {
          "@id": "https://www.geoprizm.com/#website"
        },
        about: {
          "@id": `${summary.canonicalUrl}#dataset`
        },
        dateModified
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${summary.canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "GeoPrizm",
            item: "https://www.geoprizm.com/"
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `${summary.localizedName} Relations Index`,
            item: summary.canonicalUrl
          }
        ]
      },
      {
        "@type": "Dataset",
        "@id": `${summary.canonicalUrl}#dataset`,
        name: `${summary.englishName} Relations Index`,
        description: summary.description,
        url: summary.canonicalUrl,
        inLanguage,
        creator: {
          "@id": "https://www.geoprizm.com/#organization"
        },
        license: "http://www.gdeltproject.org/about.html#termsofuse",
        isBasedOn: {
          "@type": "CreativeWork",
          name: "GDELT 2.0 Event Database",
          url: "https://www.gdeltproject.org/",
          license: "http://www.gdeltproject.org/about.html#termsofuse"
        },
        dateModified,
        temporalCoverage,
        measurementTechnique: "GDELT 2.0 CAMEO event data with weighted Goldstein scores and 14-day rolling averages",
        variableMeasured
      }
    ]
  };
}
