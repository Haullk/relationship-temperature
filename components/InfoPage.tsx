import Link from "next/link";

type InfoSection = {
  title: string;
  body: string[];
};

type InfoPageProps = {
  title: string;
  description: string;
  sections: InfoSection[];
};

export default function InfoPage({ title, description, sections }: InfoPageProps) {
  return (
    <main className="info-page">
      <header className="info-header">
        <Link className="info-back" href="/">
          GeoPrizm
        </Link>
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
    </main>
  );
}
