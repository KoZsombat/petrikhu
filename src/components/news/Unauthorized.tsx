import { btnCls } from "../../pages/SchemaForm";
import { card } from "./ui";

/** Access-denied screen: the account lacks the permission required for this view. */
export default function Unauthorized({
  onLogout,
  title = "Nincs hírkezelési jogosultságod",
  text = "Ehhez a felülethez legalább egy jogosultság kell. Kérd meg valamelyik fiókkezelőt, hogy állítsa be a fiókodon.",
}: {
  onLogout: () => void;
  title?: string;
  text?: string;
}) {
  return (
    <section className={`${card} flex flex-col items-start gap-3`}>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-sm text-petriksoft">{text}</p>
      <button type="button" className={btnCls} onClick={onLogout}>
        Kijelentkezés
      </button>
    </section>
  );
}
