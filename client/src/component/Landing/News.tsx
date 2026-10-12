import Image from "../../assets/carousel1.png";
const news = [
  {
    date: "Szept. 21.",
    title: "Nyílt nap",
    text: "Előzetes regisztráció szeptember 14-től – ismerd meg személyesen az iskolát.",
  },
  {
    date: "Szept. 28.",
    title: "Szülői értekezlet",
    text: "Az első félév tudnivalói és a tanév rendje – minden osztály szülei számára.",
  },
  {
    date: "Okt. 3.",
    title: "Kosárlabda bajnokság",
    text: "Iskolánk csapata a városi döntőben szerepel, szurkolj velünk!",
  },
  {
    date: "Okt. 12.",
    title: "Őszi könyvvásár",
    text: "A könyvtárban három napon át akciós kiadványok és író-olvasó találkozók.",
  },
  {
    date: "Okt. 23.",
    title: "Nemzeti ünnep",
    text: "Ünnepi műsor az aulában, a megemlékezés 8 órakor kezdődik.",
  },
  {
    date: "Nov. 6.",
    title: "Pályaorientációs nap",
    text: "Ismert szakemberek mutatják be hivatásukat a végzős évfolyamoknak.",
  },
  {
    date: "Nov. 18.",
    title: "Tehetségkutató",
    text: "Jelentkezz zenei, tánc- vagy színjátszó produkcióval november 10-ig.",
  },
  {
    date: "Dec. 5.",
    title: "Mikulás-délután",
    text: "Játékos feladatok, forró tea és meglepetések az alsó tagozatosoknak.",
  },
];

export default function News() {
  return (
    <section className="px-4 py-20 bg-petrikpale/30 w-full min-h-screen">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl">Aktuális hírek</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {news.map((n) => (
            <article
              key={n.title}
              className="flex flex-col bg-petrikcard rounded-xl overflow-hidden border border-black/5 shadow-sm"
            >
              <div
                className="relative h-44 border-b-4 border-petrikaccent"
                style={{
                  backgroundImage: `url(${Image})`,
                }}
              >
                <span className="absolute top-4 left-4 bg-petrikaccent text-white font-mono font-semibold text-xs uppercase tracking-widest px-4 py-2 rounded-full">
                  {n.date}
                </span>
              </div>
              <div className="flex flex-col flex-1 p-5 gap-2">
                <h2 className="font-display font-semibold text-lg text-petrikink">
                  {n.title}
                </h2>
                <p className="font-body text-petriksoft leading-relaxed text-sm flex-1">{n.text}</p>
                <a
                  href="#"
                  className="mt-4 text-xs font-semibold uppercase tracking-wider text-petrikaccentdark"
                >
                  Részletek →
                </a>
              </div>
            </article>
          ))}
        </div>
        <a
          className="text-petrikaccentdark border-b-2 border-petrikaccentdark w-max"
          href=""
        >
          Összes hír megtekintése →
        </a>
      </div>
    </section>
  );
}
