import { Phone, Mail } from "lucide-react";
import { FiFacebook, FiInstagram } from "react-icons/fi";
import { upperLinks } from "../lib/constants";

export default function UpperHeader() {
  return (
    <div className="p-2 bg-petrikink w-full">
      <nav className="flex flex-col md:flex-row md:items-center md:max-w-9/10 mx-auto justify-between">
        <div className="flex gap-4 justify-center md:justify-start items-center">
          <a className="flex items-center gap-2 text-petriklink hover:text-white cursor-pointer">
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
            href=""
            className="hidden md:flex items-center gap-2 text-petriklink hover:text-white cursor-pointer"
          >
            <FiFacebook size={16} />
          </a>
          <a
            href=""
            className="hidden md:flex items-center gap-2 text-petriklink hover:text-white cursor-pointer"
          >
            <FiInstagram size={16} />
          </a>
        </div>
        <div className="hidden md:flex flex-wrap gap-4">
          {upperLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-md text-petriklink hover:text-white cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
