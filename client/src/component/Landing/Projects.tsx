import mupa from "../../assets/partners/mupa.png";
import languagecert from "../../assets/partners/languagecert.png";
import tempus from "../../assets/partners/tempus.png";
import erasmus from "../../assets/partners/erasmus.png";
import penz7 from "../../assets/partners/penz7.png";
import etwinning from "../../assets/partners/etwinning.png";
import digitalis from "../../assets/partners/digitalis.png";
import codeweek from "../../assets/partners/codeweek.png";
import otpfay from "../../assets/partners/otpfay.png";
import prosuli from "../../assets/partners/prosuli.png";

const partners = [
  { src: mupa, alt: "MÜPA Partneriskola" },
  { src: languagecert, alt: "LanguageCert Partnerintézmény" },
  { src: tempus, alt: "Tempus Közalapítvány" },
  { src: erasmus, alt: "Erasmus+" },
  { src: penz7, alt: "Pénz7 Iskola" },
  { src: etwinning, alt: "eTwinning School" },
  { src: digitalis, alt: "Digitális Témahét 2023" },
  { src: codeweek, alt: "CodeWeek" },
  { src: otpfay, alt: "OTP Fáy Alapítvány Partneriskola" },
  { src: prosuli, alt: "ProSuli" },
];

export default function Projects() {
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl w-200 max-w-full">
          Partnerek, Projektek, Szakmai programok
        </h1>
        <p className="text-petrikfaint text-md w-140 max-w-full">
          Diákjaink nemzetközi cserekapcsolatokban, digitális projektekben és
          versenyeken vesznek részt – az iskola Örökös Ökoiskola címet visel.
        </p>
      </div>
      <div className="flex overflow-x-auto md:overflow-visible md:grid md:grid-cols-5 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10 items-center pb-4">
        {partners.map(({ src, alt }) => (
          <img key={alt} src={src} alt={alt} className="w-40 shrink-0 md:w-full h-32 object-contain" />
        ))}
      </div>
    </section>
  );
}
