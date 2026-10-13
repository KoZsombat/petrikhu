import Hero from "../component/Landing/Hero";
import News from "../component/Landing/News";
import Occupations from "../component/Landing/Occupations";
import Projects from "../component/Landing/Projects";
import Partners from "../component/Landing/Partners";
import Reasons from "../component/Landing/Reasons";
import Introduction from "../component/Landing/Introduction";

export default function Landing() {
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
