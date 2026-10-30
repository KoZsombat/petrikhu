import { Phone, Mail } from "lucide-react";
import { FiFacebook, FiInstagram } from "react-icons/fi";
import { socialLinks, upperLinks } from "../lib/constants";
import { linkProps } from "./creator/utils";
import { useLang } from "../i18n/languageContext";
import LanguageSwitch from "../i18n/LanguageSwitch";

export default function UpperHeader() {
  const { tr } = useLang();
  return (
    <div className="p-2 bg-petrikink w-full">
      <nav className="flex flex-col md:flex-row md:items-center md:max-w-9/10 mx-auto justify-between">
        <div className="flex gap-4 justify-center md:justify-start items-center">
          <a href="tel:+36705021724" className="flex items-center gap-2 text-petriklink hover:text-white cursor-pointer">
            <Phone size={16} />
            <span className="text-md">+36 70 502 1724</span>
          </a>
          <a
            href="mailto:info@petrik.hu"
            className="flex items-center gap-2 text-petriklink hover:text-white pr-4 md:border-r border-petriklink/40 cursor-pointer"
          >
            <Mail size={16} />
            <span className="text-md">info@petrik.hu</span>
          </a>
          <a
            href={socialLinks.facebook}
            {...linkProps(socialLinks.facebook)}
            aria-label="Facebook"
            className="hidden md:flex items-center gap-2 text-petriklink hover:text-white cursor-pointer"
          >
            <FiFacebook size={16} />
          </a>
          <a
            href={socialLinks.instagram}
            {...linkProps(socialLinks.instagram)}
            aria-label="Instagram"
            className="hidden md:flex items-center gap-2 text-petriklink hover:text-white cursor-pointer"
          >
            <FiInstagram size={16} />
          </a>
        </div>
        <div className="hidden md:flex flex-wrap items-center gap-4">
          {upperLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...linkProps(link.href)}
              className="text-md text-petriklink hover:text-white cursor-pointer"
            >
              {tr(link.label)}
            </a>
          ))}
          <LanguageSwitch />
        </div>
      </nav>
    </div>
  );
}
