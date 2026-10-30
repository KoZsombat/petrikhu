import type { ReactNode } from "react";
import { CardGrid, CheckList, CtaBand, LogoGrid, PageTitle, RichText, RowList } from "..";

function svgImage(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="${color}"/><text x="320" y="210" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const IMG_A = svgImage("#2B8272", "Műhelygyakorlat");
const IMG_B = svgImage("#1D5D51", "Laboratórium");
const IMG_COVER = svgImage("#85C1B6", "Petrik Lajos Technikum");

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="border-y border-petrikline bg-petrikink px-5 py-2 font-mono text-xs uppercase tracking-[0.08em] text-petrikcard sm:px-10">
      {children}
    </div>
  );
}

const textItems = [
  { eyebrow: "0091", title: "Vegyipar – kéttannyelvű", text: "Angol nyelvű szakmai oktatás, nemzetközi vegyipari partnerekkel.", href: "#", linkLabel: "RÉSZLETEK →" },
  { eyebrow: "0092", title: "Vegyipar", text: "Laboratóriumi és üzemi gyakorlat, szakmai vizsgára felkészítés.", href: "#" },
  { eyebrow: "0093", title: "Környezetvédelem", text: "Környezetanalitika, hulladékgazdálkodás és vízminőség-védelem." },
  { eyebrow: "0094", title: "Informatika és távközlés", text: "Hálózatok, programozás és rendszerüzemeltetés.", href: "https://www.petrik.hu" },
];

const dated = [
  { date: "2026. nov. 15.", title: "Jelentkezési lap leadása", text: "A kitöltött jelentkezési lapot a választott intézményben kell leadni." },
  { date: "2027. jan. 23.", title: "Központi írásbeli", text: "Magyar nyelv és matematika írásbeli felvételi vizsga." },
  { date: "2027. febr. 18.", title: "Szóbeli meghallgatás", text: "Az érintett jelentkezők szóbeli elbeszélgetése." },
];

const people = [
  { name: "Gál-Berey Csilla", role: "Igazgató", room: "Fszt. 1.", phone: "+36 1 123 4567", email: "igazgato@petrik.hu" },
  { name: "Kovács Anna", role: "Igazgatóhelyettes", room: "I. emelet 12.", phone: "+36 1 123 4568", email: "kovacs.anna@petrik.hu" },
  { name: "Szabó Péter", role: "Tanár", email: "szabo.peter@petrik.hu", photo: IMG_B },
];

const stats = [
  { value: "1879", label: "Alapítás" },
  { value: "~1200", label: "Diák" },
  { value: "130+", label: "Tanár" },
  { value: "4", label: "Képzés" },
];

const news = [
  { title: "Nyílt nap a Petrikben – várjuk az érdeklődő nyolcadikosokat", date: "2026. okt. 10.", image: { src: IMG_A, alt: "Diákok a műhelyben" }, href: "#" },
  { title: "Országos tanulmányi verseny: első hely vegyipar szakon", date: "2026. okt. 3.", href: "#" },
  { title: "Új laboratórium az informatika és távközlés képzésben", date: "2026. szept. 21.", image: { src: IMG_B, alt: "Új laboratórium" }, href: "#" },
];

const newsRows = [
  { title: "Nyílt nap a Petrikben", excerpt: "November első szombatján minden érdeklődő megismerkedhet a képzéseinkkel, a laboratóriumokkal és a tanárokkal.", date: "2026. okt. 10.", category: "Hírek", image: { src: IMG_A, alt: "Diákok a műhelyben" }, href: "#" },
  { title: "Országos tanulmányi verseny: első hely", excerpt: "Végzős diákunk első helyezést ért el az országos szakmai tanulmányi versenyen.", date: "2026. okt. 3.", category: "Versenyek", href: "#" },
  { title: "Új laboratórium készült az informatikai képzéshez", date: "2026. szept. 21.", category: "Fejlesztés", image: { src: IMG_B, alt: "Új laboratórium" }, href: "#" },
];

const filters = [
  { label: "Összes", href: "#", active: true },
  { label: "Hírek", href: "#" },
  { label: "Versenyek", href: "#" },
  { label: "Fejlesztés", href: "#" },
];

const logos = [
  { alt: "EGIS" },
  { alt: "Richter Gedeon" },
  { alt: "Teva" },
  { alt: "Sanofi" },
  { alt: "ShipCon" },
];

const checkItems = [
  "Kéttannyelvű képzés",
  "Gyakorlat vegyipari partnereknél",
  "Szakmai vizsgára felkészítés",
  "Modern laboratóriumok",
  "Nemzetközi kapcsolatok",
  "Érettségi és szakmai végzettség",
];

const legalHtml = `
<h2>Adatkezelési tájékoztató</h2>
<p>Az intézmény a személyes adatokat a hatályos jogszabályoknak megfelelően kezeli. <a href="#">További információ</a>.</p>
<ul><li>Az adatkezelő az iskola.</li><li>Az adatokat csak a szükséges ideig őrizzük.</li></ul>
<h2>Cookie-szabályzat</h2>
<h3>Szükséges sütik</h3>
<p>Az oldal működéséhez szükséges sütiket használunk.</p>
<h2>Kapcsolat</h2>
<p>Kérdés esetén írjon az <a href="mailto:adatvedelem@petrik.hu">adatvedelem@petrik.hu</a> címre.</p>
`;

export default function ComponentsPreview() {
  return (
    <main>
      <div className="px-5 py-8 sm:px-10">
        <h1 className="font-display text-3xl font-bold">Komponens-előnézet</h1>
        <p className="mt-2 text-petriksoft">Mind a 7 komponens összes változata, majd két mintaoldal.</p>
      </div>

      <Label>PageTitle · alap</Label>
      <PageTitle
        breadcrumb={[{ label: "Kezdőlap", href: "#" }, { label: "Képzések", href: "#" }, { label: "Vegyipar" }]}
        title="Vegyipari technikus képzés"
        intro="Kéttannyelvű és magyar nyelvű vegyipari képzés laboratóriumi és üzemi gyakorlattal, ismert hazai vegyipari cégek partnerségével."
      />
      <Label>PageTitle · cover</Label>
      <PageTitle
        breadcrumb={[{ label: "Kezdőlap", href: "#" }, { label: "Az iskola" }]}
        title="Az iskoláról"
        intro="1879 óta nevelünk szakembereket."
        cover={{ src: IMG_COVER, alt: "Az iskola épülete" }}
      />

      <Label>CardGrid · text (3 oszlop, linkkel)</Label>
      <CardGrid variant="text" heading="Képzéseink" columns={3} items={textItems.slice(0, 3)} />
      <Label>CardGrid · text (4 oszlop)</Label>
      <CardGrid variant="text" columns={4} items={textItems} />
      <Label>CardGrid · text (dátummal)</Label>
      <CardGrid variant="text" heading="Fontos határidők" items={dated} />
      <Label>CardGrid · person</Label>
      <CardGrid variant="person" heading="Vezetőség" items={people} />
      <Label>CardGrid · stat</Label>
      <CardGrid variant="stat" items={stats} />
      <Label>CardGrid · news</Label>
      <CardGrid variant="news" items={news} />
      <Label>CardGrid · highlight</Label>
      <CardGrid variant="highlight" title="Fontos" text="A jelentkezési lap leadási határideje 2026. november 15. Kérjük, ne hagyja az utolsó napra." />

      <Label>RowList · fact</Label>
      <RowList
        variant="fact"
        heading="Alapadatok"
        rows={[
          { label: "Alapítás éve", value: "1879" },
          { label: "OM azonosító", value: "035 xxx" },
          { label: "Képzési idő", value: "5 év (kéttannyelvű: 5+1 év)" },
        ]}
      />
      <Label>RowList · step</Label>
      <RowList
        variant="step"
        heading="Történetünk"
        rows={[
          { key: "1879", text: "Az iskola alapítása." },
          { key: "I.", text: "Első szakasz: a vegyipari szakoktatás kialakulása." },
          { key: "II.", text: "Második szakasz: bővülő képzési kínálat." },
        ]}
      />
      <Label>RowList · news (szűrő + lapozó)</Label>
      <RowList
        variant="news"
        rows={newsRows}
        filters={filters}
        pagination={{ current: 3, total: 9, hrefFor: (p) => `#oldal-${p}` }}
      />

      <Label>CheckList · két hasáb (oldalszöveg)</Label>
      <CheckList
        title="Miért a Petrik?"
        items={checkItems.slice(0, 4)}
        sideTitle="Képzési szerkezet"
        sideText="Az első két évben közismereti és alapozó szakmai tárgyak, majd szakirányú gyakorlat partnercégeknél."
      />
      <Label>CheckList · oszlopokra törve</Label>
      <CheckList title="Amit kínálunk" items={checkItems} />

      <Label>RichText · html (jogi szöveg)</Label>
      <RichText html={legalHtml} />
      <Label>RichText · children</Label>
      <RichText>
        <h2>Üdvözöljük</h2>
        <p>Ez a bekezdés <strong>React gyerekelemekből</strong> áll.</p>
      </RichText>

      <Label>CtaBand</Label>
      <CtaBand title="Érdekel a vegyipari képzés?" buttonLabel="Jelentkezés" href="#" />

      <Label>LogoGrid · helyőrző + kép</Label>
      <LogoGrid
        label="Szakmai partnereink"
        logos={[...logos, { alt: "Példa logó", src: svgImage("#B1D258", "LOGÓ"), href: "https://www.petrik.hu" }]}
      />

      <div className="mt-16 px-5 py-6 sm:px-10">
        <h2 className="font-display text-2xl font-bold">Mintaoldalak</h2>
      </div>

      <Label>Mintaoldal · Vegyipar</Label>
      <PageTitle
        breadcrumb={[{ label: "Kezdőlap", href: "#" }, { label: "Képzések", href: "#" }, { label: "Vegyipar" }]}
        title="Vegyipar"
        intro="Kéttannyelvű és magyar nyelvű vegyipari képzés laboratóriumi és üzemi gyakorlattal."
      />
      <CheckList title="Amit kínálunk" items={checkItems} />
      <CardGrid variant="text" columns={2} heading="Képzési kódok" items={textItems.slice(0, 2)} />
      <LogoGrid label="Szakmai partnereink" logos={logos} />
      <CtaBand title="Érdekel a vegyipari képzés?" buttonLabel="Jelentkezés" href="#" />

      <Label>Mintaoldal · Hírek</Label>
      <PageTitle
        breadcrumb={[{ label: "Kezdőlap", href: "#" }, { label: "Hírek" }]}
        title="Hírek"
        intro="Az iskola legfrissebb hírei, eredményei és eseményei."
      />
      <RowList
        variant="news"
        rows={newsRows}
        filters={filters}
        pagination={{ current: 1, total: 4, hrefFor: (p) => `#oldal-${p}` }}
      />
    </main>
  );
}
