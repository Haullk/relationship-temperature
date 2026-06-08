import { notFound, redirect } from "next/navigation";

import { loadCandidatePool } from "@/lib/candidatePool";
import { defaultLocale, localeFromSegment, type Locale } from "@/lib/i18n";
import { localizedPairCanonicalPath, pairCanonicalPath, pairIdFromSlug } from "@/lib/pairSeo";

type LocalizedTrendPairPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function LocalizedTrendPairPage({ params }: LocalizedTrendPairPageProps) {
  const { locale: localeSegment, slug } = await params;
  const locale = resolveContentLocale(localeSegment);
  const pairId = pairIdFromSlug(slug);
  if (pairId === null || !loadCandidatePool().legalPairIds.has(pairId)) {
    notFound();
  }

  redirect(locale === defaultLocale ? pairCanonicalPath(pairId) : localizedPairCanonicalPath(pairId, locale));
}

function resolveContentLocale(segment: string): Locale {
  const locale = localeFromSegment(segment);
  if (locale === null) {
    notFound();
  }
  return locale;
}
