import { useLang } from "../../i18n/languageContext";
import { Sparkle, Blocks, Globe, Users, Clock, User } from "lucide-react";

const reasons = [
  {
    icon: Sparkle,
    title: "Több mint 140 éves iskola",
    text: "Hagyományaink nagy múltra tekintenek vissza.",
  },
  {
    icon: Blocks,
    title: "Izgalmas projektek és programok a 21. századi készségek fejlesztéséért",
    text: "Híd az iskola és a munka világa között.",
  },
  {
    icon: Globe,
    title: "A szakképzést nemzetközi szintre emeljük",
    text: "Erasmus és eTwinning projektek részese lehetsz.",
  },
  {
    icon: Users,
    title: "Dinamikus együttműködés a pedagógusok és a tanulók között",
    text: "Itt számít, mit gondolsz!",
  },
  {
    icon: Clock,
    title: "Pezsdítő sportélet",
    text: "Sokféle sportprogramon vagy szakkörön kamatoztathatod az eddig elsajátított tudásod, vagy léphetsz a következő szintre.",
  },
  {
    icon: User,
    title: "Hogy egy igazi közösség tagjává válhass",
    text: "Programok és hagyományok, amelyek közösséggé kovácsolják az iskolát.",
  },
];

export default function Reasons() {
  const { tr } = useLang();
  return (
    <section className="px-4 py-20 bg-white w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl w-140 max-w-full">{tr("Miért jelentkezz hozzánk?")}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10">
        {reasons.map(({ icon: Icon, title, text }) => (
          <article
            key={tr(title)}
            className="flex flex-col w-full items-center text-center md:text-start md:items-start"
          >
            <div className="bg-petriktint text-petrikaccentdark size-12 rounded-full flex items-center justify-center">
              <Icon size={24} strokeWidth={1.5} />
            </div>
            <h2 className="font-display font-semibold text-xl text-petrikink mt-6">
              {tr(title)}
            </h2>
            <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">
              {tr(text)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
