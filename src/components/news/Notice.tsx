import { useSearchParams } from "react-router-dom";
import type { NoticeCode } from "../../../shared/pnw/types";
import { noticeCls } from "./ui";

const MESSAGES: Record<NoticeCode, [type: keyof typeof noticeCls, text: string]> = {
  draft_saved: ["success", "A piszkozat mentve."],
  submitted: ["success", "A hír jóváhagyásra elküldve."],
  review_saved: ["success", "A vezetői módosítások mentve."],
  approved: ["success", "A hír jóváhagyva és publikálva."],
  scheduled: ["success", "A hír jóváhagyva és időzítve. A megadott időpontban automatikusan megjelenik."],
  schedule_invalid: ["error", "Az időzített publikáláshoz adj meg egy érvényes, jövőbeli időpontot."],
  rejected: ["warning", "A hír javításra visszaküldve."],
  trashed: ["success", "A hír a lomtárba került (az Áttekintésen visszaállítható)."],
  untrashed: ["success", "A hír visszakerült piszkozatként."],
  deleted: ["success", "A hír véglegesen törölve."],
  published_updated: ["success", "A publikált hír módosításai elmentve."],
  published_archived: ["success", "A hír archiválva. Le került a nyilvános weboldalról, de az Archívumból bármikor visszaállítható."],
  archived_restored: ["success", "Az archivált hír visszaállítva és újra publikálva."],
  published_trashed: ["success", "A hír archiválva és levéve a nyilvános weboldalról."],
  production_only: ["warning", "A meglévő publikus hírek módosítása és archiválása TEST MODE-ban biztonsági okból le van tiltva."],
  missing_fields: ["error", "A cím és a hír szövege kötelező."],
  category_required: ["error", "Legalább egy kategóriát válassz."],
  rejection_note_required: ["error", "Visszaküldésnél kötelező megjegyzést írni."],
  save_error: ["error", "A mentés nem sikerült. Próbáld újra."],
};

/** A ?pnw_notice= kódhoz tartozó értesítés. */
export default function Notice() {
  const [params] = useSearchParams();
  const key = params.get("pnw_notice") as NoticeCode | null;
  if (!key || !(key in MESSAGES)) return null;

  const [type, text] = MESSAGES[key];
  return (
    <div role="status" className={`rounded-md px-4 py-3 text-sm ${noticeCls[type]}`}>
      {text}
    </div>
  );
}
