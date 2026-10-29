import Script from "next/script";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="/playground/scorer.js" strategy="afterInteractive" />
    </>
  );
}
