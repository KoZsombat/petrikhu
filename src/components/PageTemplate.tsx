import type { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import UpperHeader from "./UpperHeader";

/**
 * Az oldal kerete (fejléc, lábléc). A Creatorban összerakott komponensek
 * `children`-ként kerülnek bele. Ugyanazt a fejlécet/láblécet használja, mint a Layout.
 */
export function PageTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="contents">
        <UpperHeader />
        <Header />
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
