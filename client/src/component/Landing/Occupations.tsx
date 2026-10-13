import { FlaskConical, Droplet, Cpu } from "lucide-react";

export default function Occupations() {
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl w-140 max-w-full">Szakmák</h1>
        <p className="text-petrikfaint text-md w-140 max-w-full">
          Válaszd ki, merre indulnál – mindhárom irányban valós ipari háttérrel,
          laborokkal és gyakorlati projektekkel tanulhatsz, nyolcadikosoknak
          szervezett felvételi előkészítővel.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:max-w-4/6 mx-auto mt-10">
        <article className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
          <div className="bg-petrikaccent text-white size-12 rounded-md flex items-center justify-center">
            <FlaskConical size={24} />
          </div>
          <h2 className="font-display font-semibold text-xl text-petrikink mt-6">
            Vegyipar
          </h2>
          <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">
            140 éves hagyomány a gyógyszer- és vegyipari szakemberképzésben,
            olyan partnerekkel, mint az EGIS, a Richter Gedeon, a Teva és a
            Sanofi.
          </p>
          <a
            href="#"
            className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8"
          >
            Részletek a képzésről →
          </a>
        </article>

        <article className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
          <div className="bg-petrikink text-white size-12 rounded-md flex items-center justify-center">
            <Droplet size={24} />
          </div>
          <h2 className="font-display font-semibold text-xl text-petrikink mt-6">
            Környezetvédelem és vízügy
          </h2>
          <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">
            Gyakorlatorientált, természetközeli képzés terepmunkával és vízügyi
            laborgyakorlatokkal, a fenntarthatóság jegyében – Örökös
            Ökoiskolaként.
          </p>
          <a
            href="#"
            className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8"
          >
            Részletek a képzésről →
          </a>
        </article>

        <article className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
          <div className="bg-petrikaccentdark text-white size-12 rounded-md flex items-center justify-center">
            <Cpu size={24} />
          </div>
          <h2 className="font-display font-semibold text-xl text-petrikink mt-6">
            Informatika és távközlés
          </h2>
          <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">
            Projektalapú oktatás, amely hidat épít az iskolapad és a szakma
            között – ipari partnereink között a Cisco és a Microsoft.
          </p>
          <a
            href="#"
            className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8"
          >
            Részletek a képzésről →
          </a>
        </article>
      </div>
    </section>
  );
}
