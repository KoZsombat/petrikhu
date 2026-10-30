import Hero from "../components/Landing/Hero";
import News from "../components/Landing/News";
import Occupations from "../components/Landing/Occupations";
import Projects from "../components/Landing/Projects";
import Partners from "../components/Landing/Partners";
import Reasons from "../components/Landing/Reasons";
import Introduction from "../components/Landing/Introduction";
import { useDocumentHead } from "../lib/useDocumentHead";
import { useLang } from "../i18n/languageContext";

export default function Landing() {
  const { tr } = useLang();
  useDocumentHead({ description: tr("Vegyipari Környezetvédelmi és Informatikai Technikum a város szívében.") });
  return (
    <>
      <Hero />
      <News />
      <Occupations />
      <Reasons />
      <Projects />
      <Introduction />
      <Partners />
    </>
  );
}
