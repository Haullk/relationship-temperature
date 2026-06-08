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
  return <TrendPage initialPair={pairId} initialSeoSummary={summary} />;
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
