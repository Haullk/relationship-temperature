import type { Metadata } from "next";
import { headers } from "next/headers";

import { defaultLocale, languageAlternates, localeMeta, type Locale } from "@/lib/i18n";
import { buildSiteJsonLd } from "@/lib/siteJsonLd";
import "./globals.css";

const adsenseClient = "ca-pub-6263363592987165";
const googleAnalyticsId = "G-X8J32FCRBR";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.geoprizm.com"),
  title: localeMeta[defaultLocale].title,
  description: localeMeta[defaultLocale].description,
  alternates: {
    canonical: "/",
    languages: languageAlternates("/")
  },
  icons: {
    icon: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }]
  },
  openGraph: {
    title: localeMeta[defaultLocale].ogTitle,
    description: localeMeta[defaultLocale].ogDescription,
    url: "https://www.geoprizm.com",
    siteName: "GeoPrizm",
    locale: localeMeta[defaultLocale].openGraphLocale,
    type: "website",
    images: [
      {
        url: "/social-preview.png",
        width: 1280,
        height: 640,
        alt: localeMeta[defaultLocale].socialAlt
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: localeMeta[defaultLocale].ogTitle,
    description: localeMeta[defaultLocale].description,
    images: ["/social-preview.png"]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = resolveRequestLocale(requestHeaders.get("x-geoprizm-locale"));
  const htmlLang = localeMeta[locale].htmlLang;
  const siteJsonLd = buildSiteJsonLd(htmlLang);

  return (
    <html lang={htmlLang}>
      <head>
        <script
          id="geoprizm-site-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} />
        <script
          id="geoprizm-google-analytics"
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}');
`
          }}
        />
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

function resolveRequestLocale(value: string | null): Locale {
  return value && value in localeMeta ? (value as Locale) : defaultLocale;
}
