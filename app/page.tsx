import Link from "next/link";

export default function Home() {
  return (
    <main className="hero">
      <div className="hero-card">
        <h1 className="hero-title">Hello World</h1>
        <div className="hero-decor" aria-hidden="true" />

        <p className="hero-sub">
          A minimal Next.js demo with a protected route and Google OAuth (via
          Supabase). Click below to view the allowed signup domains.
        </p>

        <Link href="/domains" className="cta-link">
          View allowed signup domains
        </Link>
      </div>
    </main>
  );
}
