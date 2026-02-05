import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Hello World</h1>
      <Link href="/domains">View allowed signup domains</Link>
    </main>
  );
}
