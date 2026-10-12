import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { FiFacebook, FiInstagram } from "react-icons/fi";
import { menu, upperLinks } from "../lib/constants";
import Logo from "../assets/logo_nagy_ed8ce51ced.png";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-4 bg-petrikcream w-full sticky top-0 z-50 shadow-md">
      <nav className="flex flex-col md:flex-row md:items-center md:max-w-4/6 mx-auto justify-between">
        <div className="flex items-center justify-between">
          <img src={Logo} alt="Petrik Logo" className="w-50 h-auto" />
          <button
            type="button"
            className="md:hidden p-2 text-black/60 cursor-pointer"
            aria-label={open ? "Menü bezárása" : "Menü megnyitása"}
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
                        className="flex w-full items-center justify-between py-3 text-black/60 cursor-pointer"
                        aria-expanded={expanded === item.label}
                        onClick={() =>
                          setExpanded(expanded === item.label ? null : item.label)
                        }
                      >
                        {item.label}
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${expanded === item.label ? "rotate-180" : ""}`}
                        />
                      </button>
                      {expanded === item.label && (
                        <ul className="pb-2 pl-4">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <a
                                href={child.href}
                                className="block py-2 text-black/60"
                              >
                                {child.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <a
                      href={item.href}
                      className={`block py-3 text-black/60 ${item.active ? "text-[#72c3b6]!" : ""}`}
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 text-sm">
              {upperLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="block py-2 text-black/60">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-4 text-black/60">
              <a href="" aria-label="Facebook">
                <FiFacebook size={20} />
              </a>
              <a href="" aria-label="Instagram">
                <FiInstagram size={20} />
              </a>
            </div>
          </div>
        )}

        <div className="hidden md:flex items-center gap-6">
          <ul className="flex items-center gap-6 text-sm">
            {menu.map((item) => (
              <li key={item.label} className="relative group">
                {item.children ? (
                  <>
                    <a className="flex items-center gap-1 my-2 text-black/60 border-b-2 border-transparent hover:border-petrikaccent transition-colors duration-200 cursor-pointer">
                      {item.label}
                      <ChevronDown size={14} />
                    </a>
                    <ul className="absolute left-0 top-8 z-50 w-60 p-2 bg-white/90 shadow-md text-left invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity rounded-lg">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <a
                            href={child.href}
                            className="block w-full px-5 py-1.5 text-black/60 hover:bg-petrikpale/20 rounded-lg cursor-pointer"
                          >
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <a
                    href={item.href}
                    className={`flex items-center gap-1 my-2 text-black/60 border-b-2 border-transparent hover:border-petrikaccent transition-colors duration-200 cursor-pointer ${item.active ? "text-[#72c3b6]!" : ""}`}
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
