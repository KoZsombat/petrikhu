/**
 * A Creator komponenseinek sémája: mezőnként típus, felirat, kötelező-e. Közös a kliens (SchemaForm, Creator)
 * és a szerver között: a szerver (server/lib/creator-validation.ts) mentéskor ez alapján ellenőrzi a blokkokat,
 * és a tests/creator-schema.test.ts a beépített pages.json-t is.
 */
/** Egy prop leírása: milyen inputot kér a szerkesztő. */
export type Field =
  | { type: "text" | "textarea" | "url" | "image" | "html"; label: string; required?: boolean }
  | { type: "number"; label: string; required?: boolean; default?: number; min?: number }
  /** Jelölőnégyzet; üresen (nincs bejelölve) hiányzónak számít. */
  | { type: "boolean"; label: string; required?: boolean }
  | { type: "select"; label: string; required?: boolean; options: (string | number)[]; default?: string | number }
  /** Ismétlődő elemek: minden elem a `fields` szerinti objektum (vagy `string`, ha egyszerű szöveglista). */
  | { type: "list"; label: string; required?: boolean; fields: Fields | "string" }
  /** Egyetlen beágyazott objektum (pl. `cover: { src, alt }`). */
  | { type: "object"; label: string; required?: boolean; fields: Fields };

export type Fields = Record<string, Field>;

export type ComponentSchema = {
  label: string;
  /** Változat nélküli komponens: közvetlenül a `fields`. */
  fields?: Fields;
  /** Változatos komponens (`variant` prop): változatonként külön mezők. */
  variants?: Record<string, Fields>;
};

const image = (label: string): Field => ({ type: "object", label, fields: {
  src: { type: "image", label: "Kép", required: true },
  alt: { type: "text", label: "Alternatív szöveg", required: true },
} });

const limit: Field = { type: "number", label: "Megjelenített elemek maximuma", min: 0 };

export const COMPONENTS: Record<string, ComponentSchema> = {
  PageTitle: {
    label: "Oldalcím",
    fields: {
      breadcrumb: {
        type: "list", label: "Morzsamenü", required: true, fields: {
          label: { type: "text", label: "Felirat", required: true },
          href: { type: "url", label: "Link (az utolsónál nincs)" },
        },
      },
      title: { type: "text", label: "Cím", required: true },
      intro: { type: "textarea", label: "Bevezető" },
      cover: image("Borítókép"),
    },
  },

  CardGrid: {
    label: "Kártyarács",
    variants: {
      text: {
        columns: { type: "select", label: "Oszlopok", options: [2, 3, 4], default: 3 },
        heading: { type: "text", label: "Címsor" },
        items: {
          type: "list", label: "Kártyák", required: true, fields: {
            title: { type: "text", label: "Cím", required: true },
            text: { type: "textarea", label: "Szöveg" },
            eyebrow: { type: "text", label: "Felülcím" },
            date: { type: "text", label: "Dátum" },
            href: { type: "url", label: "Link" },
            linkLabel: { type: "text", label: "Link felirata" },
          },
        },
        limit,
      },
      person: {
        columns: { type: "select", label: "Oszlopok", options: [2, 3, 4], default: 3 },
        heading: { type: "text", label: "Címsor" },
        items: {
          type: "list", label: "Személyek", required: true, fields: {
            name: { type: "text", label: "Név", required: true },
            role: { type: "text", label: "Beosztás" },
            room: { type: "text", label: "Szoba" },
            phone: { type: "text", label: "Telefon" },
            email: { type: "text", label: "E-mail" },
            photo: { type: "image", label: "Fénykép" },
          },
        },
        limit,
      },
      stat: {
        columns: { type: "select", label: "Oszlopok", options: [3, 4], default: 4 },
        items: {
          type: "list", label: "Számok", required: true, fields: {
            value: { type: "text", label: "Érték", required: true },
            label: { type: "text", label: "Felirat", required: true },
          },
        },
        limit,
      },
      news: {
        columns: { type: "select", label: "Oszlopok", options: [3, 4], default: 3 },
        items: {
          type: "list", label: "Hírek", required: true, fields: {
            title: { type: "text", label: "Cím", required: true },
            date: { type: "text", label: "Dátum", required: true },
            image: image("Kép"),
            href: { type: "url", label: "Link", required: true },
          },
        },
        limit,
      },
      highlight: {
        title: { type: "text", label: "Cím" },
        text: { type: "textarea", label: "Szöveg", required: true },
      },
    },
  },

  RowList: {
    label: "Sorlista",
    variants: {
      fact: {
        heading: { type: "text", label: "Címsor" },
        rows: {
          type: "list", label: "Sorok", required: true, fields: {
            label: { type: "text", label: "Felirat", required: true },
            value: { type: "text", label: "Érték", required: true },
          },
        },
        limit,
      },
      step: {
        heading: { type: "text", label: "Címsor" },
        rows: {
          type: "list", label: "Lépések", required: true, fields: {
            key: { type: "text", label: "Kulcs (pl. dátum)", required: true },
            text: { type: "text", label: "Szöveg", required: true },
          },
        },
        limit,
      },
      news: {
        rows: {
          type: "list", label: "Hírek", required: true, fields: {
            title: { type: "text", label: "Cím", required: true },
            excerpt: { type: "textarea", label: "Kivonat" },
            date: { type: "text", label: "Dátum", required: true },
            category: { type: "text", label: "Kategória" },
            image: image("Kép"),
            href: { type: "url", label: "Link", required: true },
          },
        },
        filters: {
          type: "list", label: "Szűrők", fields: {
            label: { type: "text", label: "Felirat", required: true },
            href: { type: "url", label: "Link", required: true },
          },
        },
        // a `pagination.hrefFor` függvény, a szerkesztő generálja; csak a számok kellenek
        pagination: {
          type: "object", label: "Lapozó", fields: {
            current: { type: "number", label: "Aktuális oldal", required: true, min: 1 },
            total: { type: "number", label: "Összes oldal", required: true, min: 1 },
          },
        },
        limit,
      },
    },
  },

  CheckList: {
    label: "Pipalista",
    fields: {
      title: { type: "text", label: "Cím" },
      items: { type: "list", label: "Pontok", required: true, fields: "string" },
      sideTitle: { type: "text", label: "Oldalsó cím" },
      sideText: { type: "textarea", label: "Oldalsó szöveg" },
      limit,
    },
  },

  RichText: {
    label: "Szöveg",
    fields: {
      html: { type: "html", label: "Tartalom (sanitizált HTML)", required: true },
    },
  },

  CtaBand: {
    label: "Felhívás-sáv",
    fields: {
      title: { type: "text", label: "Cím", required: true },
      buttonLabel: { type: "text", label: "Gomb felirata", required: true },
      href: { type: "url", label: "Gomb linkje", required: true },
    },
  },

  LogoGrid: {
    label: "Logórács",
    fields: {
      label: { type: "text", label: "Felirat" },
      logos: {
        type: "list", label: "Logók", required: true, fields: {
          alt: { type: "text", label: "Név / alt", required: true },
          src: { type: "image", label: "Logó" },
          href: { type: "url", label: "Link" },
        },
      },
      limit,
    },
  },

  Feature: {
    label: "Kép + szöveg",
    fields: {
      eyebrow: { type: "text", label: "Felülcím" },
      title: { type: "text", label: "Cím", required: true },
      html: { type: "html", label: "Szöveg (sanitizált HTML)" },
      image: image("Kép"),
      imageSide: { type: "select", label: "Kép helye", options: ["left", "right"], default: "left" },
      ctaLabel: { type: "text", label: "Gomb felirata" },
      ctaHref: { type: "url", label: "Gomb linkje" },
    },
  },

  Accordion: {
    label: "Lenyíló lista",
    fields: {
      heading: { type: "text", label: "Címsor" },
      items: {
        type: "list", label: "Elemek", required: true, fields: {
          title: { type: "text", label: "Cím", required: true },
          html: { type: "html", label: "Tartalom (sanitizált HTML)", required: true },
        },
      },
      openFirst: { type: "boolean", label: "Az első elem nyitva" },
    },
  },

  VideoEmbed: {
    label: "Videó",
    fields: {
      heading: { type: "text", label: "Címsor" },
      url: { type: "url", label: "YouTube-link", required: true },
      title: { type: "text", label: "Cím" },
      caption: { type: "text", label: "Képaláírás" },
    },
  },

  Callout: {
    label: "Kiemelt közlemény",
    fields: {
      title: { type: "text", label: "Cím" },
      html: { type: "html", label: "Szöveg (sanitizált HTML)", required: true },
      tone: { type: "select", label: "Stílus", options: ["info", "accent"], default: "info" },
    },
  },

  LinkList: {
    label: "Linklista",
    fields: {
      heading: { type: "text", label: "Címsor" },
      items: {
        type: "list", label: "Linkek", required: true, fields: {
          title: { type: "text", label: "Cím", required: true },
          href: { type: "url", label: "Link (nincs: sima felsorolás)" },
          meta: { type: "text", label: "Megjegyzés" },
        },
      },
      limit,
    },
  },

  Gallery: {
    label: "Képgaléria",
    fields: {
      heading: { type: "text", label: "Címsor" },
      columns: { type: "select", label: "Oszlopok", options: [3, 4], default: 3 },
      images: {
        type: "list", label: "Képek", required: true, fields: {
          src: { type: "image", label: "Kép", required: true },
          alt: { type: "text", label: "Alternatív szöveg" },
        },
      },
      limit,
    },
  },

  DataTable: {
    label: "Táblázat",
    fields: {
      heading: { type: "text", label: "Címsor" },
      columns: { type: "list", label: "Oszlopfejlécek", required: true, fields: "string" },
      rows: {
        type: "list", label: "Sorok", required: true, fields: {
          cells: { type: "list", label: "Cellák (az oszlopok sorrendjében)", required: true, fields: "string" },
        },
      },
      footnote: { type: "text", label: "Lábjegyzet" },
      limit,
    },
  },
};

/** Egy mező üres kezdőértéke. */
function emptyValue(field: Field): unknown {
  switch (field.type) {
    case "list":
      return [];
    case "object":
      return emptyValues(field.fields);
    case "number":
      return field.default ?? "";
    case "select":
      return field.default ?? "";
    case "boolean":
      return false;
    default:
      return "";
  }
}

export function emptyValues(fields: Fields): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, emptyValue(field)]),
  );
}

