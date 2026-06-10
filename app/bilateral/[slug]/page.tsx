import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import TrendDashboard from "@/components/TrendDashboard";
import { readRelationshipCache } from "@/lib/cache";
import { loadCandidatePool } from "@/lib/candidatePool";
import { defaultLocale, languageAlternates, localeMeta } from "@/lib/i18n";
import { buildPairJsonLd } from "@/lib/pairJsonLd";
import { buildPairSeoSummary, pairCanonicalPath, pairIdFromAnySlug, pairSlug } from "@/lib/pairSeo";
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
  const summary = buildPairSeoSummary(pairId, relationship, defaultLocale);

  return {
    title: summary.title,
    description: summary.description,
    alternates: {
      canonical: summary.canonicalPath,
      languages: languageAlternates(pairCanonicalPath(pairId))
    },
    openGraph: {
      title: summary.title,
      description: summary.description,
      url: summary.canonicalUrl,
      siteName: "GeoPrizm",
      locale: localeMeta[defaultLocale].openGraphLocale,
      type: "website",
      images: [
        {
          url: "/social-preview.png",
          width: 1280,
          height: 640,
          alt: `${summary.localizedName}关系指数`
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
  const slug = (await params).slug;
  const pairId = validPairIdFromSlug(slug);
  if (pairId === null) {
    notFound();
  }
  if (pairSlug(pairId) !== slug.trim().toLowerCase()) {
    permanentRedirect(pairCanonicalPath(pairId));
  }

  const relationship = await readRelationshipPayload(pairId);
  const summary = buildPairSeoSummary(pairId, relationship, defaultLocale);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPairJsonLd(summary, relationship)) }}
      />
      <TrendDashboard initialPair={pairId} initialSeoSummary={summary} locale={defaultLocale} />
    </>
  );
}

function validPairIdFromSlug(slug: string): string | null {
  const pairId = pairIdFromAnySlug(slug);
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
