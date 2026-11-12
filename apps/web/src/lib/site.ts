/**
 * Static site chrome: menus, the green top bar, social links, footer columns and the document library.
 * These are content of the site, not the database: only posts and teachers come from the API.
 */
import type { Locale } from "./i18n";

export type MenuLeaf = { label: string; href: string };
export type MenuItem = MenuLeaf | { label: string; children: MenuLeaf[] };

export const MENUS: Record<Locale, MenuItem[]> = {
  hu: [
    {
      "label": "Kezdőlap",
      "href": "/"
    },
    {
      "label": "Hírek",
      "href": "/hirek"
    },
    {
      "label": "Bemutatkozás",
      "href": "/bemutatkozas"
    },
    {
      "label": "Oktatás",
      "children": [
        {
          "label": "Nyolcadikosoknak",
          "href": "/nyolcadikos"
        },
        {
          "label": "Közoktatás",
          "href": "/kozoktatas"
        },
        {
          "label": "Szakképzés",
          "href": "/technikusi-kepzesek"
        },
        {
          "label": "Esti munkarend",
          "href": "/hirek?kategoria=Esti munkarend"
        },
        {
          "label": "Közösségi szolgálat",
          "href": "/kozossegi-szolgalat"
        },
        {
          "label": "Nyári gyakorlatok",
          "href": "/nyari-gyakorlatok"
        }
      ]
    },
    {
      "label": "Vizsga",
      "children": [
        {
          "label": "Érettségi",
          "href": "/erettsegi-vizsga"
        },
        {
          "label": "Ágazati alapvizsga",
          "href": "/hirek?kategoria=Ágazati alapvizsga"
        },
        {
          "label": "Mellék-szakképesítés",
          "href": "/hirek?kategoria=Mellék-szakképesítés"
        },
        {
          "label": "Szakmai vizsga",
          "href": "/szakmai-vizsga"
        },
        {
          "label": "LanguageCert vizsga",
          "href": "/languagecert-vizsgak"
        }
      ]
    },
    {
      "label": "Egyéb",
      "children": [
        {
          "label": "Állásajánlatok",
          "href": "/allas"
        },
        {
          "label": "Étkezés",
          "href": "/ebed"
        },
        {
          "label": "Iskola-Egészségügy",
          "href": "/egeszsegugy"
        },
        {
          "label": "In memoriam",
          "href": "/in-memoriam"
        },
        {
          "label": "Kollégiumi lehetőségek",
          "href": "/kollegiumi-lehetosegek"
        },
        {
          "label": "Örökös Ökoiskola",
          "href": "/orokos-okoiskola"
        },
        {
          "label": "Projektek",
          "href": "/projekt"
        },
        {
          "label": "Versenyeredmény",
          "href": "/hirek?kategoria=Versenyeredmény"
        }
      ]
    },
    {
      "label": "Kapcsolat",
      "children": [
        {
          "label": "Elérhetőség",
          "href": "/elerhetoseg"
        },
        {
          "label": "Tanári kar",
          "href": "/tanari-kar"
        }
      ]
    }
  ],
  en: [
    {
      "label": "Home",
      "href": "/en"
    },
    {
      "label": "News",
      "href": "/hirek"
    },
    {
      "label": "About us",
      "href": "/en/about-us"
    },
    {
      "label": "Education",
      "children": [
        {
          "label": "For 8th graders",
          "href": "/en/admissions"
        },
        {
          "label": "General education",
          "href": "/kozoktatas"
        },
        {
          "label": "Vocational training",
          "href": "/technikusi-kepzesek"
        },
        {
          "label": "Evening classes",
          "href": "/hirek?kategoria=Esti munkarend"
        },
        {
          "label": "Community service",
          "href": "/kozossegi-szolgalat"
        },
        {
          "label": "Summer internships",
          "href": "/nyari-gyakorlatok"
        }
      ]
    },
    {
      "label": "Exams",
      "children": [
        {
          "label": "School-leaving exam",
          "href": "/erettsegi-vizsga"
        },
        {
          "label": "Sectoral basic exam",
          "href": "/hirek?kategoria=Ágazati alapvizsga"
        },
        {
          "label": "Additional qualification",
          "href": "/hirek?kategoria=Mellék-szakképesítés"
        },
        {
          "label": "Vocational exam",
          "href": "/szakmai-vizsga"
        },
        {
          "label": "LanguageCert exam",
          "href": "/languagecert-vizsgak"
        }
      ]
    },
    {
      "label": "Other",
      "children": [
        {
          "label": "Job offers",
          "href": "/allas"
        },
        {
          "label": "Meals",
          "href": "/ebed"
        },
        {
          "label": "School health service",
          "href": "/egeszsegugy"
        },
        {
          "label": "In memoriam",
          "href": "/in-memoriam"
        },
        {
          "label": "Dormitory",
          "href": "/kollegiumi-lehetosegek"
        },
        {
          "label": "Eco-school",
          "href": "/orokos-okoiskola"
        },
        {
          "label": "Projects",
          "href": "/projekt"
        },
        {
          "label": "Competition results",
          "href": "/hirek?kategoria=Versenyeredmény"
        }
      ]
    },
    {
      "label": "Contact",
      "children": [
        {
          "label": "Contact details",
          "href": "/en/contact"
        },
        {
          "label": "Teaching staff",
          "href": "/tanari-kar"
        }
      ]
    }
  ],
};

export const upperLinks: { key: string; href: string }[] = [
  { key: "nav.substitutions", href: "https://filc.petrik.hu/subs" },
  { key: "nav.calendar", href: "https://outlook.office365.com/owa/calendar/d318bbea4a914be2abe826c0b376cc50@petrik.hu/240a9f1bbed44e0fb49ae8369939f7773872042457095598299/calendar.html" },
  { key: "nav.timetable", href: "https://filc.petrik.hu/" },
  { key: "nav.documents", href: "/dokumentumtar" },
  { key: "nav.privacy", href: "/adatvedelem" },
  { key: "nav.kreta", href: "http://bmszc-petrik.e-kreta.hu/" },
  { key: "nav.mail", href: "https://outlook.office.com/owa/" },
];

export const socialLinks = {
  facebook: "https://www.facebook.com/BMSZCPetrik/",
  instagram: "https://www.instagram.com/petrikinsta/",
};

export const footerColumns: { title: string; links: { key: string; href: string }[] }[] = [
  {
    title: "nav.education",
    links: [
      { key: "nav.eighthGraders", href: "/nyolcadikos" },
      { key: "nav.publicEducation", href: "/kozoktatas" },
      { key: "nav.vocational", href: "/technikusi-kepzesek" },
      { key: "nav.evening", href: "/hirek?kategoria=Esti munkarend" },
      { key: "nav.communityService", href: "/kozossegi-szolgalat" },
      { key: "nav.summerInternships", href: "/nyari-gyakorlatok" },
    ],
  },
  {
    title: "nav.exams",
    links: [
      { key: "nav.maturaExam", href: "/erettsegi-vizsga" },
      { key: "nav.sectoralExam", href: "/hirek?kategoria=Ágazati alapvizsga" },
      { key: "nav.additionalQualification", href: "/hirek?kategoria=Mellék-szakképesítés" },
      { key: "nav.vocationalExam", href: "/szakmai-vizsga" },
      { key: "nav.languageCert", href: "/languagecert-vizsgak" },
    ],
  },
  {
    title: "nav.other",
    links: [
      { key: "nav.jobs", href: "/allas" },
      { key: "nav.meals", href: "/ebed" },
      { key: "nav.health", href: "/egeszsegugy" },
      { key: "nav.inMemoriam", href: "/in-memoriam" },
      { key: "nav.dormitory", href: "/kollegiumi-lehetosegek" },
      { key: "nav.ecoSchool", href: "/orokos-okoiskola" },
      { key: "nav.projects", href: "/projekt" },
      { key: "nav.competitions", href: "/hirek?kategoria=Versenyeredmény" },
    ],
  },
];

/**
 * Automatic localization of a Hungarian path: when the target locale has a static translation (see
 * TRANSLATIONS) that page is used; otherwise the original path is kept (EN chrome links to HU content),
 * and the home page maps to the locale's home.
 */
export function localizedHref(
  locale: Locale,
  href: string,
  translations: { hu: string; en: string }[],
): string {
  if (locale === "hu") return href;

  const [path = href, query] = href.split("?");
  const pair = translations.find((entry) => `/${entry.hu}` === path);
  let target = path;
  if (pair) target = `/en/${pair.en}`;
  else if (path === "/") target = "/en";
  else if (!path.startsWith("/en")) target = path;

  return query ? `${target}?${query}` : target;
}

/** The other language's version of the current page, or that language's home page. */
export function counterpart(pathname: string, target: Locale, translations: { hu: string; en: string }[]): string {
  if (target === "en") {
    const pair = translations.find((entry) => pathname === `/${entry.hu}`);
    return pair ? `/en/${pair.en}` : "/en";
  }
  const pair = translations.find((entry) => pathname === `/en/${entry.en}`);
  return pair ? `/${pair.hu}` : "/";
}
