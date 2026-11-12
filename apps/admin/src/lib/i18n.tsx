import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "hu" | "en";

/**
 * Source Hungarian UI strings → English. The admin is written in Hungarian; switching to English
 * translates the rendered chrome automatically (text nodes, placeholders, titles, aria-labels).
 * Content from the database is not translated.
 */
const EN: Record<string, string> = {
  // shell / nav
  "Admin": "Admin",
  "Áttekintés": "Overview",
  "Hírek": "News",
  "Tanárok": "Teachers",
  "Dokumentumok": "Documents",
  "Felhasználók": "Users",
  "Kilépés": "Sign out",
  "Adminisztrátor": "Administrator",
  "Szerkesztő": "Editor",
  "Jóváhagyó": "Reviewer",
  "Szerző": "Author",
  "Inaktív": "Inactive",
  "Munkamenet ellenőrzése…": "Checking session…",
  "Admin menü": "Admin menu",

  // login
  "Belépés": "Sign in",
  "Adminisztrációs felület. Új fiókot csak adminisztrátor hozhat létre.":
    "Administration. New accounts can only be created by an administrator.",
  "E-mail": "Email",
  "Jelszó": "Password",
  "Sikertelen bejelentkezés": "Sign-in failed",
  "A kezdeti admin fiókot a szerver hozza létre az ADMIN_EMAIL és ADMIN_PASSWORD környezeti változókból; ez a fiók nem törölhető.":
    "The initial admin account is created from the ADMIN_EMAIL and ADMIN_PASSWORD environment variables; it cannot be deleted.",

  // dashboard
  "Hírek, tanárok, dokumentumok és fiókok egy helyen.":
    "News, teachers, documents and accounts in one place.",
  "Jóváhagyásra váró hírek": "Posts awaiting review",
  "Nincs jóváhagyásra váró hír.": "No posts are waiting for review.",
  "Gyors műveletek": "Quick actions",
  "Új hír": "New post",
  "Tanár hozzáadása": "Add teacher",
  "Dokumentum feltöltése": "Add document",
  "Felhasználó létrehozása": "Create user",
  "Összes hír": "All posts",
  "A fiókodhoz még nincs hozzáférés rendelve. Kérj szerepkört egy adminisztrátortól.":
    "Your account has no access yet. Ask an administrator for a role.",

  // generic
  "Tartalom": "Content",
  "Közzététel": "Publishing",
  "Hozzáférés": "Access",
  "Intézmény": "School",
  "Betöltés…": "Loading…",
  "Betöltési hiba": "Loading failed",
  "Mentési hiba": "Saving failed",
  "Hiba": "Error",
  "Mégse": "Cancel",
  "Mentés": "Save",
  "Törlés": "Delete",
  "Szerkesztés": "Edit",
  "Frissítés": "Refresh",
  "Bezárás": "Close",
  "Keresés": "Search",
  "Válassz kategóriát…": "Choose a category…",
  "Cím / slug / kategória": "Title / slug / category",
  "találat": "results",
  "oldal": "page",
  "Előző": "Previous",
  "Következő": "Next",
  "Műveletek": "Actions",
  "Sorrend": "Order",
  "Publikált": "Published",
  "Rejtett": "Hidden",
  "Védett": "Protected",
  "Piszkozat": "Draft",
  "Jóváhagyásra vár": "Pending review",
  "Rendszer-admin": "System admin",
  "PublIKÁLÁS": "Publish",
  "Publikálás": "Publish",
  "Rejtés": "Hide",
  "Elrejtés": "Hide",

  // tables / forms
  "Cím": "Title",
  "Slug": "Slug",
  "Kategória": "Category",
  "Kivonat": "Excerpt",
  "Borítókép": "Cover image",
  "Név": "Name",
  "Munkakör": "Role",
  "Munkakör / tantárgy": "Role / subject",
  "Elérhetőség": "Contact",
  "Terem": "Room",
  "Fotó": "Photo",
  "Fájl": "File",
  "Szerepkör": "Role",
  "Létrehozva": "Created",
  "Dátum": "Date",
  "Állapot": "Status",
  "Fájl URL (üresen védett)": "File URL (leave empty for protected)",

  // posts
  "hír": "post",
  "jóváhagyásra vár": "awaiting review",
  "Új hír létrehozása": "Create post",
  "Hír szerkesztése": "Edit post",
  "Beküldés jóváhagyásra": "Submit for review",
  "Jóváhagyás": "Approve",
  "Visszaküldés": "Send back",
  "Miért küldöd vissza? (opcionális)": "Why are you sending it back? (optional)",
  "A mentés nem változtatja meg a hír állapotát.":
    "Saving does not change the post status.",
  "Az új hír piszkozatként jön létre; beküldés után jóváhagyásra vár.":
    "A new post is created as a draft; once submitted it awaits review.",
  "Piszkozat létrehozása": "Create draft",
  "Új hírt piszkozatként hozhatsz létre, majd beküldheted jóváhagyásra. Publikálni csak jóváhagyó vagy adminisztrátor tud.":
    "You can create posts as drafts and submit them for review. Only a reviewer or administrator can publish.",

  // teachers
  "tanár": "teacher",
  "Új tanár": "New teacher",
  "Tanári kar": "Teaching staff",
  "Tanár szerkesztése": "Edit teacher",
  "Tanár létrehozása": "Create teacher",
  "Még nincs tanár.": "No teachers yet.",
  "PublIKÁLT": "Published",

  // documents
  "kategória": "category",
  "dokumentum": "document",
  "Új dokumentum": "New document",
  "Új kategória": "New category",
  "Dokumentumtár": "Document library",
  "Dokumentum szerkesztése": "Edit document",
  "Dokumentum létrehozása": "Create document",
  "Kategória létrehozása": "Create category",
  "Kategória törlése": "Delete category",
  "Még nincs kategória.": "No categories yet.",
  "Nincs dokumentum ebben a kategóriában.": "No documents in this category.",
  "Még nincs feltöltött dokumentum.": "No documents uploaded yet.",

  // users
  "Fiókok": "Accounts",
  "Új felhasználó": "New user",
  "Jelszó visszaállítása": "Reset password",
  "Nincs jogosultság": "No permission",
  "A felhasználók kezeléséhez adminisztrátori szerepkör szükséges.":
    "Managing users requires the administrator role.",
  "Fiókok létrehozása és szerepkörök módosítása.":
    "Create accounts and change roles.",
  "Új jelszó": "New password",
  "A jelszó legalább 8 karakter legyen.": "The password must be at least 8 characters.",



  // permissions / gallery / documents
  "Fiókok és jogosultságok kezelése.": "Manage accounts and permissions.",
  "A fiók csak a kijelölt jogosultságokkal rendelkezik. A módosítás a következő kérésnél érvényes.": "The account has only the selected permissions. Changes apply on the next request.",
  "Nincs kiválasztott jogosultság — a fiók csak be tud jelentkezni.": "No permissions selected — the account can only sign in.",
  "Dokumentum kiválasztása": "Choose document",
  "Dokumentum cseréje": "Change document",
  "Dokumentum eltávolítása": "Remove document",
  "Nincs kiválasztott dokumentum. Védett dokumentumhoz hagyd üresen.": "No document selected. Leave empty for a protected document.",
  "Új dokumentum feltöltése": "Upload new document",
  "PDF, Office, TXT, CSV, ZIP · max 25 MB": "PDF, Office, TXT, CSV, ZIP · max 25 MB",
  "Dokumentumok törlése": "Delete documents",
  "Kép hozzáadása": "Add image",
  "A galéria üres. A borítókép mellett további képeket is hozzáadhatsz.": "The gallery is empty. Add more images beside the cover.",
  "Kép hozzáadása a galériához": "Add image to gallery",
  "Galéria": "Gallery",
  "Táblázat sorai": "Table rows",
  "Táblázat oszlopai": "Table columns",
  "Beszúrás": "Insert",
  "Dokumentum": "Document",
  "jogosultság": "permissions",

  // permissions
  "Média": "Media",
  "Áttekintés megtekintése": "View dashboard",
  "Hírek listázása (piszkozatok is)": "List posts (including drafts)",
  "Hír létrehozása": "Create post",
  "Hír törlése": "Delete post",
  "Hír beküldése jóváhagyásra": "Submit post for review",
  "Hír jóváhagyása / elutasítása": "Approve / reject post",
  "Hír publikálása": "Publish post",
  "Médiatár megtekintése": "View media library",
  "Kép feltöltése": "Upload image",
  "Kép törlése": "Delete image",
  "Tanárok listázása (rejtettek is)": "List teachers (including hidden)",
  "Tanárok kezelése": "Manage teachers",
  "Dokumentumok listázása": "List documents",
  "Dokumentumok és kategóriák kezelése": "Manage documents and categories",
  "Felhasználók megtekintése": "View users",
  "Felhasználók létrehozása, szerkesztése, törlése": "Create, edit and delete users",
  "További jogosultságok adása": "Grant extra permissions",
  "Jogosultságok": "Permissions",
  "További jogosultságok": "Extra permissions",
  "Jogosultságok betöltése…": "Loading permissions…",
  "Jogosultságok mentése": "Save permissions",
  "Jogosultságlista hiba": "Permission catalog failed to load",
  "egyedi": "custom",
  "(szerepkör)": "(role)",
  "Szerepkörök és egyedi jogosultságok kezelése.": "Manage roles and extra permissions.",
  "A szerepkör alapjogosultságai fixek. Itt további jogosultságokat adhatsz a felhasználónak; a módosítás azonnal érvényes a következő kérésnél.":
    "Role defaults are fixed. Grant extra permissions here; changes apply on the next request.",
  "A szerepkör alapjogosultságait a létrehozás után a pajzs ikonnal egészítheted ki.":
    "After creating the account, extend the role defaults with the shield icon.",
  "A felhasználók kezeléséhez `users.view` jogosultság szükséges.":
    "Managing users requires the `users.view` permission.",

  // image picker
  "Kép kiválasztása": "Choose image",
  "Kép cseréje": "Change image",
  "Kép eltávolítása": "Remove image",
  "Új kép feltöltése": "Upload new image",
  "Feltöltés…": "Uploading…",
  "Képek törlése": "Delete images",
  "Még nincs feltöltött kép.": "No images uploaded yet.",
  "JPEG, PNG, WebP, AVIF, GIF · max 10 MB": "JPEG, PNG, WebP, AVIF, GIF · max 10 MB",
  "Feltöltési hiba": "Upload failed",
  "Kép beszúrása": "Insert image",
  "Kép beszúrása a tartalomba": "Insert image into content",
  "Hivatkozás": "Link",
  "Hivatkozás URL-je": "Link URL",
  "Félkövér": "Bold",
  "Dőlt": "Italic",
  "Áthúzott": "Strikethrough",
  "Cím 2": "Heading 2",
  "Cím 3": "Heading 3",
  "Felsorolás": "Bullet list",
  "Számozott lista": "Numbered list",
  "Idézet": "Quote",
  "Táblázat": "Table",
  "Visszavonás": "Undo",
  "Újra": "Redo",
};

const HU: Record<string, string> = Object.fromEntries(
  Object.entries(EN).map(([hu, en]) => [en, hu]),
);

const ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

type Ctx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<Ctx>({ lang: "hu", setLang: () => {} });

const DYNAMIC_EN: [RegExp, string][] = [
  [/^(\d+) hír · (\d+) jóváhagyásra vár$/, "$1 posts · $2 awaiting review"],
  [/^(\d+) hír · (\d+) publikálva$/, "$1 posts · $2 published"],
  [/^(\d+) tanár$/, "$1 teachers"],
  [/^(\d+) kategória · (\d+) dokumentum$/, "$1 categories · $2 documents"],
  [/^(\d+) találat · (\d+)\/(\d+)\. oldal$/, "$1 results · page $2 of $3"],
  [/^Jogosultságok — (.+)$/, "Permissions — $1"],
  [/^(\d+) egyedi$/, "$1 custom"],
  [/^(\d+) jogosultság$/, "$1 permissions"],
];

const translateValue = (value: string, lang: Lang) => {
  if (lang === "en") {
    for (const [pattern, replacement] of DYNAMIC_EN) {
      if (pattern.test(value.trim())) return value.trim().replace(pattern, replacement);
    }
  }

  const map = lang === "en" ? EN : HU;
  const key = value.trim();
  const translated = map[key];
  if (!translated) return value;
  return value.replace(key, translated);
};

const translateNode = (node: Node, lang: Lang) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || parent.closest("[data-no-translate]")) return;
    if (["SCRIPT", "STYLE"].includes(parent.tagName)) return;
    const text = node.nodeValue ?? "";
    const next = translateValue(text, lang);
    if (next !== text) node.nodeValue = next;
    return;
  }

  if (!(node instanceof Element)) return;
  if (node.closest("[data-no-translate]")) return;

  for (const attribute of ATTRIBUTES) {
    const value = node.getAttribute(attribute);
    if (!value) continue;
    const next = translateValue(value, lang);
    if (next !== value) node.setAttribute(attribute, next);
  }

  for (const child of Array.from(node.childNodes)) translateNode(child, lang);
};

const walk = (root: Node, lang: Lang) => {
  translateNode(root, lang);
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = window.localStorage.getItem("admin-lang");
    if (stored === "hu" || stored === "en") return stored;
    return navigator.language.toLowerCase().startsWith("hu") ? "hu" : "en";
  });

  const setLang = (next: Lang) => {
    window.localStorage.setItem("admin-lang", next);
    setLangState(next);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    walk(document.body, lang);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          walk(mutation.target, lang);
        } else if (mutation.type === "childList") {
          for (const node of Array.from(mutation.addedNodes)) walk(node, lang);
        } else if (mutation.type === "attributes" && mutation.target) {
          walk(mutation.target, lang);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
