import Header from "./Header";
import Footer from "./Footer";
import UpperHeader from "./UpperHeader";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="contents">
        <UpperHeader />
        <Header />
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
