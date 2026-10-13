import egis from "../../assets/partners/egis.png";
import richter from "../../assets/partners/richter.png";
import teva from "../../assets/partners/teva.png";
import sanofi from "../../assets/partners/sanofi.png";
import cisco from "../../assets/partners/cisco.png";
import microsoft from "../../assets/partners/microsoft.png";

const partners = [
  { src: egis, alt: "EGIS" },
  { src: richter, alt: "Gedeon Richter Ltd." },
  { src: teva, alt: "Teva" },
  { src: sanofi, alt: "Sanofi" },
  { src: cisco, alt: "Cisco" },
  { src: microsoft, alt: "Microsoft" },
];

export default function Partners() {
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl w-140 max-w-full">
          Szakmai partnerek
        </h1>
      </div>
      <div className="flex overflow-x-auto md:overflow-visible md:grid md:grid-cols-6 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10 items-center pb-4">
        {partners.map(({ src, alt }) => (
          <img
            key={alt}
            src={src}
            alt={alt}
            className="w-40 shrink-0 md:w-full h-32 object-contain"
          />
        ))}
      </div>
    </section>
  );
}
