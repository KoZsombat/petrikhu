import { Sparkle, Blocks, Globe, Users, Clock, User } from "lucide-react";

const reasons = [
  {
    icon: Sparkle,
    title: "140+ éves szakmai hagyomány",
    text: "Több mint egy évszázados tapasztalat a vegyipari, környezetvédelmi és informatikai szakemberképzésben.",
  },
  {
    icon: Blocks,
    title: "Gyakorlatközeli oktatás",
    text: "Projektalapú tanulás, amely valódi ipari háttérrel hidat épít az iskolapad és a szakma között.",
  },
  {
    icon: Globe,
    title: "Nemzetközi sztenderdek",
    text: "Erasmus+ csereprogramok és eTwinning projektek nyitják ki a diákok látókörét.",
  },
  {
    icon: Users,
    title: "Tanár-diák együttműködés",
    text: "Dinamikus, személyes kapcsolat a tanárok és a diákok között a mindennapi munkában.",
  },
  {
    icon: Clock,
    title: "Sokszínű sport és szakkörök",
    text: "Széles sport- és szakköri kínálat biztosítja, hogy mindenki megtalálja a magának valót.",
  },
  {
    icon: User,
    title: "Erős közösségi élet",
    text: "Programok és hagyományok, amelyek évfolyamokon átívelő közösséggé kovácsolják az iskolát.",
  },
];

export default function Reasons() {
  return (
    <section className="px-4 py-20 bg-white w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl w-140 max-w-full">
          Miért jelentkezz hozzánk?
        </h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10">
        {reasons.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="flex flex-col w-full items-center text-center md:text-start md:items-start"
          >
            <div className="bg-petriktint text-petrikaccentdark size-12 rounded-full flex items-center justify-center">
              <Icon size={24} strokeWidth={1.5} />
            </div>
            <h2 className="font-display font-semibold text-xl text-petrikink mt-6">
              {title}
            </h2>
            <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">
              {text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
