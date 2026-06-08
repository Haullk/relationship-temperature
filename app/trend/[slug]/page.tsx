import { notFound, redirect } from "next/navigation";

import { loadCandidatePool } from "@/lib/candidatePool";
import { pairCanonicalPath, pairIdFromSlug } from "@/lib/pairSeo";

type TrendPairPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TrendPairPage({ params }: TrendPairPageProps) {
  const pairId = pairIdFromSlug((await params).slug);
  if (pairId === null || !loadCandidatePool().legalPairIds.has(pairId)) {
    notFound();
  }

  redirect(pairCanonicalPath(pairId));
}
