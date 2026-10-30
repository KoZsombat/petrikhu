import { useLang } from "../../i18n/languageContext";
const counters = [
  { value: "1178", label: "Diák" },
  { value: "120", label: "Oktató" },
  { value: "35", label: "Tanterem" },
  { value: "23", label: "Labor" },
  { value: "1", label: "Cél" },
];

export default function Introduction() {
  const { tr } = useLang();
  return (
    <section className="px-4 py-20 bg-white w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:flex-row justify-evenly items-center md:max-w-4/6 mx-auto gap-10">
        <div className="md:w-1/2 aspect-video">
          <iframe
            className="w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/NnanAwvV8FI"
            title={tr("Válaszd a Petriket!")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
        <div className="flex flex-col gap-5 md:w-1/2 text-center md:text-start">
          <h1 className="text-2xl font-bold italic font-serif">{tr("Rólunk – Aki Petrikes lesz…")}</h1>
          <p className="text-petrikfaint text-md">{tr("… részévé válik egy több mint 140 éve létező hagyománynak, amit a Petrik neve fémjelez. Aki Petrikes lesz, egy elfogadó, egymást támogató iskolai közösség tagja lesz. Aki Petrikes lesz, olyan szaktudást kap, amellyel könnyedén elhelyezkedhet a munka világában, hiszen a Petrik neve garancia a kiemelkedő szaktudásra. Ha Petrikes leszel, olyan életre szóló élményekkel fogsz gazdagodni, amelyekre mindig vidáman és szeretettel gondolsz majd vissza. Mire vársz még?")}</p>
        </div>
      </div>
      <dl className="mx-auto mt-14 grid grid-cols-2 gap-6 text-center sm:grid-cols-5 md:max-w-4/6">
        {counters.map((c) => (
          <div key={tr(c.label)}>
            <dd className="font-display text-4xl font-bold text-petrikaccentdark">{c.value}</dd>
            <dt className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-petriksoft">{tr(c.label)}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
