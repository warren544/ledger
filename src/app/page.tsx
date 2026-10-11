import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Ledger reconciliation</h1>
      <p>Use the synthetic P1/P5 demo flow.</p>
      <p><Link href="/cases">Open the exception queue</Link></p>
    </main>
  );
}
