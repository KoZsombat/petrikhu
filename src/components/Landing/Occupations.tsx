import { useLang } from "../../i18n/languageContext";
import { FlaskConical, Droplet, Cpu } from "lucide-react";

export default function Occupations() {
  const { tr } = useLang();
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl w-140 max-w-full">{tr("Képzési kínálatunk")}</h1>
        <p className="text-petrikfaint text-md w-140 max-w-full">{tr("Vegyipar – a jövő a te kezedben. Környezetvédelem és vízügy – a jövőről te gondoskodsz. Informatika és távközlés – a jövő egy kattintásra tőled.")}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:max-w-4/6 mx-auto mt-10">
        <article className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
          <div className="bg-petrikaccent text-white size-12 rounded-md flex items-center justify-center">
            <FlaskConical size={24} />
          </div>
          <h2 className="font-display font-semibold text-xl text-petrikink mt-6">{tr("Vegyipar")}</h2>
          <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">{tr("A jövő gyógyszeripari vagy vegyipari szakembereként szeretnél hozzájárulni ahhoz, hogy az emberiség leküzdhesse az őt sújtó betegségeket, járványokat vagy egyre környezetbarátabb technológiákkal tegye kényelmesebbé a mindennapi életet? Több mint 140 éves hagyományokra visszatekintő vegyészeti képzésünk, amelynek része a két tanítási nyelvű képzés is, csak rád vár!")}</p>
          <a
            href="/vegyipar-agazat"
            className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8"
          >{tr("Tudj meg róla többet →")}</a>
        </article>

        <article className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
          <div className="bg-petrikink text-white size-12 rounded-md flex items-center justify-center">
            <Droplet size={24} />
          </div>
          <h2 className="font-display font-semibold text-xl text-petrikink mt-6">{tr("Környezetvédelem és vízügy")}</h2>
          <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">{tr("Ha törődsz a környezeteddel, de szeretnél többet tenni a megóvásáért, akkor a környezetvédelmi szakirány az, ami neked való. A környezetvédelem hivatás és tudomány is egyben. Gyakorlati tudásalapú képzésünk garancia arra, hogy a jövő környezetvédelmi szakemberévé válhass.")}</p>
          <a
            href="/kornyezetvedelem-agazat"
            className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8"
          >{tr("Tudj meg róla többet →")}</a>
        </article>

        <article className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
          <div className="bg-petrikaccentdark text-white size-12 rounded-md flex items-center justify-center">
            <Cpu size={24} />
          </div>
          <h2 className="font-display font-semibold text-xl text-petrikink mt-6">{tr("Informatika és távközlés")}</h2>
          <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">{tr("Informatikai szakirányunk képzései a jövő munkaerő-piacára készítik fel a tanulóinkat: gyakorlatorientált környezetben az elméleti, gyakorlati tantárgyakat az idegen nyelv tanulásával ötvözve olyan projektalapú oktatásban részesülhetsz, mely hidat képez a munka világa és az iskola között.")}</p>
          <a
            href="/informatika-agazat"
            className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8"
          >{tr("Tudj meg róla többet →")}</a>
        </article>
      </div>
    </section>
  );
}
