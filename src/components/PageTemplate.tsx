import type { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import UpperHeader from "./UpperHeader";

/**
 * Page frame (header, footer). Components assembled in the Creator
 * passed in as `children`. Uses the same header/footer as Layout.
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
