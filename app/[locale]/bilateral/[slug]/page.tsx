import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import TrendDashboard from "@/components/TrendDashboard";
import { readRelationshipCache } from "@/lib/cache";
import { loadCandidatePool } from "@/lib/candidatePool";
import { defaultLocale, languageAlternates, localeFromSegment, localeMeta, type Locale } from "@/lib/i18n";
import { buildPairJsonLd } from "@/lib/pairJsonLd";
import { buildPairSeoSummary, pairCanonicalPath, pairIdFromSlug } from "@/lib/pairSeo";
import type { RelationshipPayload } from "@/lib/types";

type LocalizedBilateralPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocalizedBilateralPageProps): Promise<Metadata> {
  const { locale: localeSegment, slug } = await params;
  const locale = localeFromSegment(localeSegment);
  const pairId = validPairIdFromSlug(slug);
  if (locale === null || pairId === null) {
    return {
      title: "Relationship pair not found | GeoPrizm",
      robots: { index: false, follow: true }
    };
  }

  const relationship = await readRelationshipPayload(pairId);
  const summary = buildPairSeoSummary(pairId, relationship, locale);

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
      locale: localeMeta[locale].openGraphLocale,
      type: "website",
      images: [
        {
          url: "/social-preview.png",
          width: 1280,
          height: 640,
          alt: `${summary.localizedName} Relations Index`
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

export default async function LocalizedBilateralPage({ params }: LocalizedBilateralPageProps) {
  const { locale: localeSegment, slug } = await params;
  const locale = resolveContentLocale(localeSegment);
  const pairId = validPairIdFromSlug(slug);
  if (pairId === null) {
    notFound();
  }
  if (locale === defaultLocale) {
    redirect(pairCanonicalPath(pairId));
  }

  const relationship = await readRelationshipPayload(pairId);
  const summary = buildPairSeoSummary(pairId, relationship, locale);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPairJsonLd(summary, relationship)) }}
      />
      <TrendDashboard initialPair={pairId} initialSeoSummary={summary} locale={locale} />
    </>
  );
}

function resolveContentLocale(segment: string): Locale {
  const locale = localeFromSegment(segment);
  if (locale === null) {
    notFound();
  }
  return locale;
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
