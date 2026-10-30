import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import Logo from "../assets/logo_nagy_ed8ce51ced.png";

const columns = [
  {
    title: "Oktatás",
    links: [
      "Nyolcadikosoknak",
      "Közoktatás",
      "Szakképzés",
      "Esti munkarend",
      "Közösségi szolgálat",
      "Nyári gyakorlatok",
    ],
  },
  {
    title: "Vizsga",
    links: [
      "Érettségi",
      "Ágazati alapvizsga",
      "Mellék-szakképesítés",
      "Szakmai vizsga",
      "LanguageCert vizsga",
    ],
  },
  {
    title: "Egyéb",
    links: [
      "Állásajánlatok",
      "Étkezés",
      "Iskola-egészségügy",
      "In memoriam",
      "Kollégiumi lehetőségek",
      "Örökös Ökoiskola",
      "Projektek",
      "Versenyeredmény",
    ],
  },
];

export default function Footer() {
  return (
    <footer className="text-sm bg-petrikink text-petriklink text-center md:text-start">
      <div className="md:max-w-4/6 mx-auto px-4 pt-14 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr]">
          <div>
            <div className="inline-block rounded-lg bg-white p-1">
              <img src={Logo} alt="Petrik Logo" className="h-auto w-52" />
            </div>
            <p className="mt-5 leading-relaxed text-petriklink/80">
              Budapesti Műszaki SZC Petrik Lajos
              <br />
              Két Tanítási Nyelvű Technikum
            </p>
            <p className="mt-5 font-mono text-sm leading-6 text-petriklink/50">
              OM azonosító: 203 058
              <br />
              Technikai kód: 520413
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 font-mono text-sm uppercase tracking-[0.25em] text-petriklink/50">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((label) => (
                  <li key={label}>
                    <a
                      href=""
                      className="text-petriklink hover:text-white transition-colors duration-200"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-4 font-mono text-sm uppercase tracking-[0.25em] text-petriklink/50">
              Kapcsolat
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start justify-center gap-3 md:justify-start">
                <MapPin size={14} className="mt-1 shrink-0" />
                <span>1146 Budapest, Thököly út 48–54.</span>
              </li>
              <li className="flex items-center justify-center gap-3 md:justify-start">
                <Phone size={14} className="shrink-0" />
                <a
                  href="tel:+36705021724"
                  className="text-petriklink hover:text-white transition-colors duration-200"
                >
                  +36 70 502 1724
                </a>
              </li>
              <li className="flex items-center justify-center gap-3 md:justify-start">
                <Mail size={14} className="shrink-0" />
                <a
                  href="mailto:info@petrik.hu"
                  className="text-petriklink hover:text-white transition-colors duration-200"
                >
                  info@petrik.hu
                </a>
              </li>
              <li>
                <a
                  href=""
                  className="text-petriklink hover:text-white transition-colors duration-200"
                >
                  Tanári kar
                </a>
              </li>
            </ul>
            <div className="mt-4 flex justify-center gap-3 md:justify-start">
              <a
                href=""
                aria-label="Facebook"
                className="flex size-11 items-center justify-center rounded-full border border-petriklink/20 hover:border-white hover:text-white transition-colors duration-200"
              >
                <FaFacebookF size={14} />
              </a>
              <a
                href=""
                aria-label="Instagram"
                className="flex size-11 items-center justify-center rounded-full border border-petriklink/20 hover:border-white hover:text-white transition-colors duration-200"
              >
                <FaInstagram size={14} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-petriklink/15 pt-6 text-sm sm:flex-row items-center sm:justify-between">
          <p className="text-petriklink/50">
            © 2026 Budapesti Műszaki SZC Petrik Lajos Két Tanítási Nyelvű
            Technikum · Minden jog fenntartva.
          </p>
          <div className="flex gap-6">
            <a
              href=""
              className="text-petriklink hover:text-white transition-colors duration-200"
            >
              Adatvédelem
            </a>
            <a
              href=""
              className="text-petriklink hover:text-white transition-colors duration-200"
            >
              Adatkezelési tájékoztató
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
