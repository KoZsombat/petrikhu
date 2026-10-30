import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { FiFacebook, FiInstagram } from "react-icons/fi";
import { menu as defaultMenu, socialLinks, upperLinks } from "../lib/constants";
import { SmartLink } from "./SmartLink";
import type { MenuItem } from "../../shared/pnw/creator-types";
import { useSiteContent } from "../lib/siteContext";
import { useLang } from "../i18n/languageContext";
import LanguageSwitch from "../i18n/LanguageSwitch";
import Logo from "../assets/logo_nagy_ed8ce51ced.png";

// Several menu items may point to the same page (e.g. /hirek): only the first match is active.
function ownersOf(menu: MenuItem[]) {
  const owner = new Map<string, string>();
  for (const item of menu) {
    for (const entry of item.children ?? [item]) {
      if (entry.href && !owner.has(entry.href)) owner.set(entry.href, entry.label);
    }
  }
  return owner;
}

export default function Header() {
  const { pathname } = useLocation();
  const { tr } = useLang();
  // The menu saved by the editor; the built-in one if there is none.
  const menu: MenuItem[] = useSiteContent().menu ?? defaultMenu;
  const hrefOwner = ownersOf(menu);
  const isActive = (label: string, href: string) =>
    href !== "" && pathname === href && hrefOwner.get(href) === label;
  const hasActiveChild = (item: MenuItem) =>
    item.children?.some((c) => isActive(c.label, c.href)) ?? false;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Navigation is client-side now (SmartLink), so close the mobile menu when the route changes.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  return (
    <div className="p-4 bg-petrikcream w-full sticky top-0 z-50 shadow-md">
      <nav className="flex flex-col md:flex-row md:items-center md:max-w-4/6 mx-auto justify-between">
        <div className="flex items-center justify-between">
          <img src={Logo} alt="Petrik Logo" className="w-50 h-auto" />
          <button
            type="button"
            className="md:hidden p-2 text-black/60 cursor-pointer"
            aria-label={open ? tr("Menü bezárása") : tr("Menü megnyitása")}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden mt-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <ul className="flex flex-col text-base">
              {menu.map((item) => (
                <li key={item.label} className="border-b border-black/10">
                  {item.children ? (
                    <>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between py-3 cursor-pointer ${hasActiveChild(item) ? "text-petrikaccentdark font-semibold" : "text-black/60"}`}
                        aria-expanded={expanded === item.label}
                        onClick={() =>
                          setExpanded(expanded === item.label ? null : item.label)
                        }
                      >
                        {tr(item.label)}
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${expanded === item.label ? "rotate-180" : ""}`}
                        />
                      </button>
                      {expanded === item.label && (
                        <ul className="pb-2 pl-4">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <SmartLink
                                href={child.href}
                                aria-current={isActive(child.label, child.href) ? "page" : undefined}
                                className={`block py-2 ${isActive(child.label, child.href) ? "text-petrikaccentdark font-semibold" : "text-black/60"}`}
                              >
                                {tr(child.label)}
                              </SmartLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <SmartLink
                      href={item.href}
                      aria-current={isActive(item.label, item.href ?? "") ? "page" : undefined}
                      className={`block py-3 ${isActive(item.label, item.href ?? "") ? "text-petrikaccentdark font-semibold" : "text-black/60"}`}
                    >
                      {tr(item.label)}
                    </SmartLink>
                  )}
                </li>
              ))}
            </ul>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 text-sm">
              {upperLinks.map((link) => (
                <li key={link.label}>
                  <SmartLink href={link.href} className="block py-2 text-black/60">
                    {tr(link.label)}
                  </SmartLink>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-4 text-black/60">
              <SmartLink href={socialLinks.facebook} aria-label="Facebook">
                <FiFacebook size={20} />
              </SmartLink>
              <SmartLink href={socialLinks.instagram} aria-label="Instagram">
                <FiInstagram size={20} />
              </SmartLink>
              <LanguageSwitch tone="light" className="ml-auto" />
            </div>
          </div>
        )}

        <div className="hidden md:flex items-center gap-6">
          <ul className="flex items-center gap-6 text-sm">
            {menu.map((item) => (
              <li key={item.label} className="relative group">
                {item.children ? (
                  <>
                    <a className={`flex items-center gap-1 my-2 border-b-2 hover:border-petrikaccent transition-colors duration-200 cursor-pointer ${hasActiveChild(item) ? "text-petrikaccentdark border-petrikaccent" : "text-black/60 border-transparent"}`}>
                      {tr(item.label)}
                      <ChevronDown size={14} />
                    </a>
                    <ul className="absolute left-0 top-8 z-50 w-60 p-2 bg-white/90 shadow-md text-left invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity rounded-lg">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <SmartLink
                            href={child.href}
                            aria-current={isActive(child.label, child.href) ? "page" : undefined}
                            className={`block w-full px-5 py-1.5 hover:bg-petrikpale/20 rounded-lg cursor-pointer ${isActive(child.label, child.href) ? "text-petrikaccentdark font-semibold" : "text-black/60"}`}
                          >
                            {tr(child.label)}
                          </SmartLink>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <SmartLink
                    href={item.href}
                    aria-current={isActive(item.label, item.href ?? "") ? "page" : undefined}
                    className={`flex items-center gap-1 my-2 border-b-2 hover:border-petrikaccent transition-colors duration-200 cursor-pointer ${isActive(item.label, item.href ?? "") ? "text-petrikaccentdark border-petrikaccent" : "text-black/60 border-transparent"}`}
                  >
                    {tr(item.label)}
                  </SmartLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
