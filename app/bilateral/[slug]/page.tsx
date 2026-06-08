import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TrendPage from "@/app/page";
import { readRelationshipCache } from "@/lib/cache";
import { loadCandidatePool } from "@/lib/candidatePool";
import { buildPairSeoSummary, pairIdFromSlug } from "@/lib/pairSeo";
import type { RelationshipPayload } from "@/lib/types";

type BilateralPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BilateralPageProps): Promise<Metadata> {
  const pairId = validPairIdFromSlug((await params).slug);
  if (pairId === null) {
    return {
      title: "关系组合不存在 | GeoPrizm",
      robots: { index: false, follow: true }
    };
  }

  const relationship = await readRelationshipPayload(pairId);
  const summary = buildPairSeoSummary(pairId, relationship);

  return {
    title: summary.title,
    description: summary.description,
    alternates: {
      canonical: summary.canonicalPath
    },
    openGraph: {
      title: summary.title,
      description: summary.description,
      url: summary.canonicalUrl,
      siteName: "GeoPrizm",
      locale: "zh_CN",
      type: "website",
      images: [
        {
          url: "/social-preview.png",
          width: 1280,
          height: 640,
          alt: `${summary.chineseName}关系指数`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: summary.title,
      description: summary.description,
      images: ["/social-preview.png"]
    }
  };
}

export default async function BilateralPage({ params }: BilateralPageProps) {
  const pairId = validPairIdFromSlug((await params).slug);
  if (pairId === null) {
    notFound();
  }

  const relationship = await readRelationshipPayload(pairId);
  const summary = buildPairSeoSummary(pairId, relationship);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPairJsonLd(summary, relationship)) }}
      />
      <TrendPage initialPair={pairId} initialSeoSummary={summary} />
    </>
  );
}

function validPairIdFromSlug(slug: string): string | null {
  const pairId = pairIdFromSlug(slug);
  if (pairId === null) {
    return null;
  }
  const pool = loadCandidatePool();
  return pool.legalPairIds.has(pairId) ? pairId : null;
}

async function readRelationshipPayload(pairId: string): Promise<RelationshipPayload | null> {
  const result = await readRelationshipCache(pairId).catch(() => ({ payload: null }));
  return result.payload;
}

function buildPairJsonLd(summary: ReturnType<typeof buildPairSeoSummary>, relationship: RelationshipPayload | null) {
  const dateModified = summary.generatedAt ?? summary.dataEnd ?? undefined;
  const temporalCoverage = summary.dataStart && summary.dataEnd ? `${summary.dataStart}/${summary.dataEnd}` : undefined;
  const variableMeasured = [
    {
      "@type": "PropertyValue",
      name: "relationship_temperature",
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
        inLanguage: "zh-CN",
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
            name: `${summary.chineseName}关系指数`,
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
        inLanguage: "zh-CN",
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
