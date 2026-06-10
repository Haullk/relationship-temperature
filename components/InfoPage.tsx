import Link from "next/link";

type InfoFact = {
  label: string;
  value: string;
};

type InfoLink = {
  href: string;
  label: string;
  external?: boolean;
};

type InfoSection = {
  title: string;
  body: string[];
  facts?: InfoFact[];
  links?: InfoLink[];
};

type InfoPageProps = {
  title: string;
  description: string;
  sections: InfoSection[];
  rootElement?: "main" | "article";
  showBack?: boolean;
};

export default function InfoPage({ title, description, sections, rootElement = "main", showBack = true }: InfoPageProps) {
  const RootTag = rootElement;

  return (
    <RootTag className="info-page">
      <header className="info-header">
        {showBack ? (
          <Link className="info-back" href="/">
            GeoPrizm
          </Link>
        ) : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="info-sections">
        {sections.map((section) => (
          <section className="info-card" key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.facts ? (
              <dl className="info-facts">
                {section.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {section.links ? (
              <div className="info-links">
                {section.links.map((link) => (
                  <Link
                    href={link.href}
                    key={link.href}
                    rel={link.external ? "noreferrer" : undefined}
                    target={link.external ? "_blank" : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <footer className="info-footer">
        <Link href="/">返回首页</Link>
        <Link href="/methodology">方法说明</Link>
        <Link href="/privacy">隐私政策</Link>
        <Link href="/contact">联系方式</Link>
        <Link href="/disclaimer">免责声明</Link>
      </footer>
    </RootTag>
  );
}
