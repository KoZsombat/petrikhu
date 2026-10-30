import { btnCls } from "../pages/SchemaForm";
import Logo from "../assets/logo_nagy_ed8ce51ced.png";

/** A szerkesztő felületek (Hírkezelő, Vezérlőpult, Creator) közös fejlécsávja: logó, felület neve, felhasználó, kijelentkezés. */
export default function AdminHeader({
  title,
  name,
  hint,
  onLogout,
}: {
  title: string;
  name: string;
  /** Súgó a névre vitt egérhez (pl. a jogosultságok). */
  hint?: string;
  onLogout: () => void;
}) {
  return (
    <header className="border-b border-petriklinesoft bg-petrikcard">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <a href="/" aria-label="Kezdőlap" className="flex items-center gap-4">
          <img src={Logo} alt="Petrik" className="h-10 w-auto" />
          <span className="hidden border-l border-petrikline pl-4 sm:block">
            <span className="block font-mono text-xs uppercase tracking-[0.25em] text-petrikaccentdark">Petrik</span>
            <span className="font-display text-xl font-bold leading-tight">{title}</span>
          </span>
        </a>
        <div className="flex items-center gap-4">
          <strong title={hint} className="font-mono text-xs uppercase tracking-[0.2em] text-petrikaccentdark">
            {name}
          </strong>
          <button type="button" className={btnCls} onClick={onLogout}>
            Kijelentkezés
          </button>
        </div>
      </div>
    </header>
  );
}
