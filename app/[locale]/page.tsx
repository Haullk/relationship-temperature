import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import TrendDashboard from "@/components/TrendDashboard";
import { buildHomeJsonLd } from "@/lib/homeSeo";
import {
  defaultLocale,
  languageAlternates,
  localeFromSegment,
  localeMeta,
  routedLocales,
  type Locale
} from "@/lib/i18n";

type LocalizedHomePageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routedLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalizedHomePageProps): Promise<Metadata> {
  const locale = localeFromSegment((await params).locale);
  if (locale === null) {
    return {
      title: "GeoPrizm",
      robots: { index: false, follow: true }
    };
  }
  const meta = localeMeta[locale];
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: locale === defaultLocale ? "/" : `/${locale}`,
      languages: languageAlternates("/")
    },
    openGraph: {
      title: meta.ogTitle,
      description: meta.ogDescription,
      url: locale === defaultLocale ? "/" : `/${locale}`,
      siteName: "GeoPrizm",
      locale: meta.openGraphLocale,
      type: "website",
      images: [
        {
          url: "/social-preview.png",
          width: 1280,
          height: 640,
          alt: meta.socialAlt
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: meta.ogTitle,
      description: meta.description,
      images: ["/social-preview.png"]
    }
  };
}

export default async function LocalizedHomePage({ params }: LocalizedHomePageProps) {
  const locale = resolveContentLocale((await params).locale);
  if (locale === defaultLocale) {
    redirect("/");
  }
  return (
    <>
      <script
        id="geoprizm-home-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeJsonLd(locale)) }}
      />
      <TrendDashboard locale={locale} />
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
