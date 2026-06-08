import TrendDashboard from "@/components/TrendDashboard";
import { defaultLocale } from "@/lib/i18n";

export default function HomePage() {
  return <TrendDashboard locale={defaultLocale} />;
}
