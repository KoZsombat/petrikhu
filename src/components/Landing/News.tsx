import { useLang } from "../../i18n/languageContext";
import Image from "../../assets/carousel1.png";
import { useLatestPosts } from "../../lib/news";

export default function News() {
  const { tr } = useLang();
  const { rows: news } = useLatestPosts(8);
  if (news.length === 0) return null;
  return (
    <section className="px-4 py-20 bg-petrikpale/30 w-full max-w-screen overflow-x-hidden min-h-screen">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h1 className="text-2xl font-bold md:text-4xl">{tr("Aktuális hírek")}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {news.map((n) => (
            <article
              key={n.href}
              className="flex flex-col bg-petrikcard rounded-xl overflow-hidden border border-black/5 shadow-sm"
            >
              <div
                className="relative h-44 border-b-4 border-petrikaccent"
                style={{
                  backgroundImage: `url(${n.image?.src ?? Image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
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
                <p className="font-body text-petriksoft leading-relaxed text-sm flex-1 line-clamp-3">{n.excerpt}</p>
                <a
                  href={n.href}
                  className="mt-4 text-xs font-semibold uppercase tracking-wider text-petrikaccentdark"
                >{tr("Részletek →")}</a>
              </div>
            </article>
          ))}
        </div>
        <a
          className="text-petrikaccentdark border-b-2 border-petrikaccentdark w-max"
          href="/hirek"
        >{tr("Összes hír megtekintése →")}</a>
      </div>
    </section>
  );
}
