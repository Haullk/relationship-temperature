import { notFound, redirect } from "next/navigation";

import { defaultLocale, localeFromSegment, localizedPath, type Locale } from "@/lib/i18n";

type LocalizedTrendPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedTrendPage({ params }: LocalizedTrendPageProps) {
  const locale = resolveContentLocale((await params).locale);
  redirect(locale === defaultLocale ? "/" : localizedPath(locale, "/"));
}

function resolveContentLocale(segment: string): Locale {
  const locale = localeFromSegment(segment);
  if (locale === null) {
    notFound();
  }
  return locale;
}
