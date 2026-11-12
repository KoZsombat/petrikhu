export interface PostTemplate {
  id: string;
  label: string;
  category: string;
  excerpt: string;
  html: string;
  text: string;
}

const paragraph = (text: string) => `<p>${text}</p>`;

export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: "blank",
    label: "Üres hír",
    category: "Hírek",
    excerpt: "",
    html: "<p></p>",
    text: "",
  },
  {
    id: "news",
    label: "Általános hír",
    category: "Hírek",
    excerpt: "Rövid összefoglaló a hírről.",
    html: [
      "<h2>Bevezetés</h2>",
      paragraph("Írd le, mi történt, kik vettek részt, és miért fontos."),
      "<h2>Részletek</h2>",
      paragraph("Helyszín, időpont, résztvevők, eredmények."),
      "<h2>Kapcsolódó linkek</h2>",
      paragraph("Ide kerülhetnek a további információk."),
    ].join(""),
    text: "Bevezetés\n\nÍrd le, mi történt, kik vettek részt, és miért fontos.\n\nRészletek\n\nHelyszín, időpont, résztvevők, eredmények.",
  },
  {
    id: "open-day",
    label: "Nyílt nap",
    category: "Hírek",
    excerpt: "Nyílt napunk időpontja és regisztrációs tudnivalói.",
    html: [
      "<h2>Időpont és helyszín</h2>",
      paragraph("Dátum: …\nIdőpont: …\nHelyszín: 1146 Budapest, Thököly út 48–54."),
      "<h2>Regisztráció</h2>",
      paragraph("A részvétel regisztrációhoz kötött. Jelentkezési link: …"),
      "<h2>Program</h2>",
      "<ul><li>Iskolabemutató</li><li>Laborlátogatás</li><li>Kérdések és válaszok</li></ul>",
    ].join(""),
    text: "Időpont és helyszín\n\nDátum: …\nIdőpont: …\nHelyszín: 1146 Budapest, Thököly út 48–54.\n\nRegisztráció\n\nA részvétel regisztrációhoz kötött.",
  },
  {
    id: "competition",
    label: "Versenyeredmény",
    category: "Díjak és elismerések",
    excerpt: "Diákjaink eredménye a … versenyen.",
    html: [
      "<h2>Eredmény</h2>",
      paragraph("A … versenyen … helyezést értünk el."),
      "<h2>Résztvevők</h2>",
      paragraph("Felkészítő tanár: …\nCsapattagok: …"),
      "<h2>Gratulálunk!</h2>",
      paragraph("Köszönjük a felkészítést és a részvételt."),
    ].join(""),
    text: "Eredmény\n\nA … versenyen … helyezést értünk el.\n\nRésztvevők\n\nFelkészítő tanár: …\nCsapattagok: …",
  },
  {
    id: "job",
    label: "Állásajánlat",
    category: "Állásajánlatok",
    excerpt: "Az iskola … munkakörbe munkatársat keres.",
    html: [
      "<h2>Munkakör</h2>",
      paragraph("Az iskola … munkakörbe keres munkatársat."),
      "<h2>Feladatok</h2>",
      "<ul><li>…</li><li>…</li></ul>",
      "<h2>Elvárások</h2>",
      "<ul><li>…</li><li>…</li></ul>",
      "<h2>Jelentkezés</h2>",
      paragraph("Jelentkezési határidő: …\nKapcsolat: …"),
    ].join(""),
    text: "Munkakör\n\nAz iskola … munkakörbe keres munkatársat.\n\nFeladatok\n\n- …\n- …",
  },
  {
    id: "menu",
    label: "Étkezés",
    category: "Étkezések",
    excerpt: "A … heti menü.",
    html: [
      "<h2>Heti menü</h2>",
      "<table><thead><tr><th>Nap</th><th>Ebéd</th></tr></thead><tbody>",
      "<tr><td>Hétfő</td><td>…</td></tr>",
      "<tr><td>Kedd</td><td>…</td></tr>",
      "<tr><td>Szerda</td><td>…</td></tr>",
      "<tr><td>Csütörtök</td><td>…</td></tr>",
      "<tr><td>Péntek</td><td>…</td></tr>",
      "</tbody></table>",
    ].join(""),
    text: "Heti menü\n\nHétfő: …\nKedd: …\nSzerda: …\nCsütörtök: …\nPéntek: …",
  },
  {
    id: "memoriam",
    label: "In memoriam",
    category: "In Memoriam",
    excerpt: "Emlékezés …",
    html: [
      "<h2>Emlékezés</h2>",
      paragraph("Fájdalommal búcsúzunk …"),
      paragraph("Nyugodjék békében."),
    ].join(""),
    text: "Emlékezés\n\nFájdalommal búcsúzunk …\n\nNyugodjék békében.",
  },
  {
    id: "project",
    label: "Projekt",
    category: "Projekt",
    excerpt: "A … projekt bemutatása.",
    html: [
      "<h2>A projektről</h2>",
      paragraph("A projekt célja …"),
      "<h2>Eredmények</h2>",
      paragraph("…"),
      "<h2>Partnerek</h2>",
      paragraph("…"),
    ].join(""),
    text: "A projektről\n\nA projekt célja …\n\nEredmények\n\n…",
  },
  {
    id: "erasmus",
    label: "Erasmus+",
    category: "Erasmus+",
    excerpt: "Erasmus+ programunk hírei.",
    html: [
      "<h2>Program</h2>",
      paragraph("…"),
      "<h2>Mobilitás</h2>",
      paragraph("…"),
      "<h2>Beszámoló</h2>",
      paragraph("…"),
    ].join(""),
    text: "Program\n\n…\n\nMobilitás\n\n…",
  },
];
