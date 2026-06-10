import TrendDashboard from "@/components/TrendDashboard";
import { buildHomeJsonLd } from "@/lib/homeSeo";
import { defaultLocale } from "@/lib/i18n";

export default function HomePage() {
  return (
    <>
      <script
        id="geoprizm-home-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeJsonLd(defaultLocale)) }}
      />
      <TrendDashboard locale={defaultLocale} />
    </>
  );
}
