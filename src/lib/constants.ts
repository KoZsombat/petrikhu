export const menu = [
  { label: "Kezdőlap", href: "/" },
  { label: "Hírek", href: "/hirek" },
  { label: "Bemutatkozás", href: "/bemutatkozas" },
  {
    label: "Oktatás",
    children: [
      { label: "Nyolcadikosoknak", href: "/nyolcadikos" },
      { label: "Közoktatás", href: "/kozoktatas" },
      { label: "Szakképzés", href: "/technikusi-kepzesek" },
      { label: "Esti munkarend", href: "/hirek?kategoria=Esti munkarend" },
      { label: "Közösségi szolgálat", href: "/kozossegi-szolgalat" },
      { label: "Nyári gyakorlatok", href: "/nyari-gyakorlatok" },
    ],
  },
  {
    label: "Vizsga",
    children: [
      { label: "Érettségi", href: "/erettsegi-vizsga" },
      { label: "Ágazati alapvizsga", href: "/hirek?kategoria=Ágazati alapvizsga" },
      { label: "Mellék-szakképesítés", href: "/hirek?kategoria=Mellék-szakképesítés" },
      { label: "Szakmai vizsga", href: "/szakmai-vizsga" },
      { label: "LanguageCert vizsga", href: "/languagecert-vizsgak" },
    ],
  },
  {
    label: "Egyéb",
    children: [
      { label: "Állásajánlatok", href: "/allas" },
      { label: "Étkezés", href: "/ebed" },
      { label: "Iskola-Egészségügy", href: "/egeszsegugy" },
      { label: "In memoriam", href: "/in-memoriam" },
      { label: "Kollégiumi lehetőségek", href: "/kollegiumi-lehetosegek" },
      { label: "Örökös Ökoiskola", href: "/orokos-okoiskola" },
      { label: "Projektek", href: "/projekt" },
      { label: "Versenyeredmény", href: "/hirek?kategoria=Versenyeredmény" },
    ],
  },
  {
    label: "Kapcsolat",
    children: [
      { label: "Elérhetőség", href: "/elerhetoseg" },
      { label: "Tanári kar", href: "/tanari-kar" },
    ],
  },
];

export const upperLinks = [
  { label: "Helyettesítés", href: "https://filc.petrik.hu/subs" },
  {
    label: "Eseménynaptár",
    href: "https://outlook.office365.com/owa/calendar/d318bbea4a914be2abe826c0b376cc50@petrik.hu/240a9f1bbed44e0fb49ae8369939f7773872042457095598299/calendar.html",
  },
  { label: "Órarend", href: "https://filc.petrik.hu/" },
  { label: "Dokumentumtár", href: "/dokumentumtar" },
  { label: "Adatvédelem", href: "/adatvedelem" },
  { label: "Kréta", href: "http://bmszc-petrik.e-kreta.hu/" },
  { label: "Levelezés", href: "https://outlook.office.com/owa/" },
];

/** Közösségi linkek (felső sáv, fejléc, lábléc). */
export const socialLinks = {
  facebook: "https://www.facebook.com/BMSZCPetrik/",
  instagram: "https://www.instagram.com/petrikinsta/",
};

/** Felirat → útvonal (a lábléc és más, csak felirattal hivatkozó helyek használják). */
export const labelHref: Record<string, string> = {
  "Kezdőlap": "/",
  "Hírek": "/hirek",
  "Bemutatkozás": "/bemutatkozas",
  "Nyolcadikosoknak": "/nyolcadikos",
  "Közoktatás": "/kozoktatas",
  "Szakképzés": "/technikusi-kepzesek",
  "Esti munkarend": "/hirek?kategoria=Esti munkarend",
  "Közösségi szolgálat": "/kozossegi-szolgalat",
  "Nyári gyakorlatok": "/nyari-gyakorlatok",
  "Érettségi": "/erettsegi-vizsga",
  "Ágazati alapvizsga": "/hirek?kategoria=Ágazati alapvizsga",
  "Mellék-szakképesítés": "/hirek?kategoria=Mellék-szakképesítés",
  "Szakmai vizsga": "/szakmai-vizsga",
  "LanguageCert vizsga": "/languagecert-vizsgak",
  "Állásajánlatok": "/allas",
  "Étkezés": "/ebed",
  "Iskola-Egészségügy": "/egeszsegugy",
  "Iskola-egészségügy": "/egeszsegugy",
  "In memoriam": "/in-memoriam",
  "Kollégiumi lehetőségek": "/kollegiumi-lehetosegek",
  "Örökös Ökoiskola": "/orokos-okoiskola",
  "Projektek": "/projekt",
  "Versenyeredmény": "/hirek?kategoria=Versenyeredmény",
  "Elérhetőség": "/elerhetoseg",
  "Tanári kar": "/tanari-kar",
  "About Us": "/about-us",
  "Adatvédelem": "/adatvedelem",
  "Adatkezelési tájékoztató": "/adatkezelesi-tajekoztato",
};
