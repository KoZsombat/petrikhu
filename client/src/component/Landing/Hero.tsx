import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import MoleculeField from "./MoleculeField";
import SchoolImage from "../../assets/carousel1.png";

const HEADLINE = "Több mint 140 éve az érték a mérték.".split(" ");

const STATS = [
  { value: 140, prefix: "", suffix: "+", label: "Év szakmai hagyomány" },
  { value: 1200, prefix: "~", suffix: "", label: "Diák a Petriken" },
  { value: 25, prefix: "~", suffix: "%", label: "Kéttannyelvű képzésben" },
];

function CountUp({ to, prefix, suffix }: { to: number; prefix: string; suffix: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduce ? 0 : 1400;
    const dur = reduce ? 1 : 1800;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(Math.max((t - t0) / dur, 0), 1);
      setN(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <>
      {prefix}
      {n}
      {suffix}
    </>
  );
}

export default function Hero() {
  return (
    <section className="relative isolate w-full max-w-screen overflow-x-hidden overflow-hidden bg-[#1B2420] text-petrikcream">
      <img
        src={SchoolImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="hero-glow absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-petrikaccent/40 blur-[120px]" />
      <div className="hero-glow absolute -bottom-52 right-0 h-[30rem] w-[30rem] rounded-full bg-petriklight/20 blur-[130px] [animation-delay:-6s]" />
      <MoleculeField />
      <div className="hero-stripes pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-[40rem] max-w-7xl flex-col justify-center px-6 py-10 md:min-h-[46rem] md:px-10">
        <p
          className="hero-rise font-mono text-[10px] uppercase tracking-[0.2em] text-petrikpale md:text-xs"
          style={{ animationDelay: "0.1s" }}
        >
          Budapesti Műszaki SZC · OM 203 058 · Budapest, VI. kerület
        </p>

        <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-[1.05] md:text-6xl">
          {HEADLINE.map((word, i) => (
            <span key={i} className="mr-[0.25em] inline-block overflow-hidden align-bottom">
              <span
                className="hero-word inline-block"
                style={{ animationDelay: `${0.25 + i * 0.09}s` }}
              >
                {word}
              </span>
            </span>
          ))}
        </h1>

        <p
          className="hero-rise mt-5 max-w-lg font-body text-sm leading-relaxed text-petrikcream/80 md:text-base"
          style={{ animationDelay: "1s" }}
        >
          Vegyipari, környezetvédelmi és informatikai képzés a főváros szívében –
          két tanítási nyelven, ipari partnerekkel és gyakorlatközeli
          projektekkel, nyolcadikosoktól a felnőttoktatásig.
        </p>

        <div
          className="hero-rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-4"
          style={{ animationDelay: "1.15s" }}
        >
          <a
            href="#"
            className="group inline-flex items-center gap-3 rounded-full bg-petrikaccent px-6 py-3 text-sm font-body font-semibold text-white shadow-[0_0_40px_-4px_rgba(43,130,114,0.8)] transition hover:bg-petrikaccentdark"
          >
            Nyolcadikosoknak
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#"
            className="border-b-2 border-petrikcream/30 pb-0.5 text-sm font-body font-semibold transition hover:border-petriklight hover:text-petriklight"
          >
            Képzéseink megismerése
          </a>
        </div>

        <dl
          className="hero-rise mt-8 grid max-w-2xl grid-cols-3 gap-4 border-t border-petrikcream/20 pt-5 md:mt-10"
          style={{ animationDelay: "1.3s" }}
        >
          {STATS.map((s) => (
            <div key={s.label}>
              <dd className="font-display text-2xl font-semibold tabular-nums md:text-4xl">
                <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} />
              </dd>
              <dt className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-petrikcream/60 md:text-[11px]">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
