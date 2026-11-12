import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { SubmitEvent } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog } from "../components/Dialog";
import { ImageField } from "../components/ImageField";
import { createTeacher, deleteTeacher, listTeachers, updateTeacher } from "../lib/api";
import { usePermissions } from "../lib/permissions";
import { teacherInputSchema, type Teacher, type TeacherInput } from "../lib/schemas";
import {
  actions,
  badge,
  badgeLive,
  buttonPrimary,
  checkbox,
  code,
  empty,
  eyebrow,
  field,
  fieldError,
  form,
  formError,
  formRow,
  iconButton,
  iconButtonDanger,
  input,
  page,
  pageTitle,
  panel,
  panelTitle,
  table,
  tableWrap,
  td,
  th,
} from "../lib/ui";

const emptyDraft: TeacherInput = {
  name: "",
  role: "",
  email: null,
  room: null,
  photo: null,
  sortOrder: 0,
  published: true,
};

type FieldErrors = Record<string, string | undefined>;

export function TeachersPage() {
  const permissions = usePermissions();
  const canManage = permissions.has("teachers.manage");

  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TeacherInput>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setError(null);
      setTeachers(await listTeachers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Betöltési hiba");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const close = () => {
    setFormOpen(false);
    setDraft(emptyDraft);
    setEditingId(null);
    setFieldErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const parsed = teacherInputSchema.safeParse(draft);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }

    setSaving(true);
    try {
      if (editingId) await updateTeacher(editingId, parsed.data);
      else await createTeacher(parsed.data);
      close();
      await refresh();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (teacher: Teacher) => {
    setEditingId(teacher.id);
    setDraft({
      name: teacher.name,
      role: teacher.role,
      email: teacher.email,
      room: teacher.room,
      photo: teacher.photo,
      sortOrder: teacher.sortOrder,
      published: teacher.published,
    });
    setFieldErrors({});
    setSubmitError(null);
    setFormOpen(true);
  };

  const togglePublished = async (teacher: Teacher) => {
    try {
      await updateTeacher(teacher.id, { published: !teacher.published });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  const remove = async (teacher: Teacher) => {
    if (!window.confirm(`Törlöd: „${teacher.name}”?`)) return;
    try {
      await deleteTeacher(teacher.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>Intézmény</span>
          <h1 className={`mt-1 ${pageTitle}`}>Tanárok</h1>
          <p className="mt-1.5 text-[14.5px] text-soft">
            {teachers ? `${teachers.length} tanár` : "Betöltés…"}
          </p>
        </div>
        {canManage ? (
          <button className={buttonPrimary} type="button" onClick={() => { setDraft(emptyDraft); setEditingId(null); setFormOpen(true); }}>
            <Plus className="size-4" aria-hidden /> Új tanár
          </button>
        ) : null}
      </header>

      {error ? <p className={formError}>{error}</p> : null}

      <section className={panel}>
        <h2 className={panelTitle}>Tanári kar</h2>
        {teachers === null ? (
          <p className={empty}><Loader2 className="mx-auto mb-1 size-4 animate-spin" /> Betöltés…</p>
        ) : teachers.length === 0 ? (
          <p className={empty}>Még nincs tanár.</p>
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Név</th>
                  <th className={th}>Munkakör</th>
                  <th className={th}>Elérhetőség</th>
                  <th className={th}>Állapot</th>
                  <th className={th} aria-label="Műveletek" />
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <img
                          className="size-9 rounded-full bg-tint object-cover"
                          src={teacher.photo ?? "/img/teacher-placeholder.png"}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <strong>{teacher.name}</strong>
                      </div>
                    </td>
                    <td className={td}>{teacher.role}</td>
                    <td className={td}>
                      <div>{teacher.email}</div>
                      <div className={code}>{teacher.room}</div>
                    </td>
                    <td className={td}>
                      <span className={teacher.published ? badgeLive : badge}>
                        {teacher.published ? "Publikált" : "Rejtett"}
                      </span>
                    </td>
                    <td className={td}>
                      <div className={actions}>
                        {canManage ? (
                          <>
                            <button className={iconButton} type="button" title="Szerkesztés" onClick={() => startEdit(teacher)}>
                              <Pencil className="size-3.5" aria-hidden />
                            </button>
                            <button className={iconButton} type="button" title={teacher.published ? "Elrejtés" : "Publikálás"} onClick={() => void togglePublished(teacher)}>
                              {teacher.published ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                            </button>
                            <button className={iconButtonDanger} type="button" title="Törlés" onClick={() => void remove(teacher)}>
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={formOpen} title={editingId ? "Tanár szerkesztése" : "Új tanár"} onClose={close}>
        <form className={form} onSubmit={handleSubmit} noValidate>
          {submitError ? <p className={formError}>{submitError}</p> : null}

          <div className={formRow}>
            <label className={field}>
              <span>Név</span>
              <input className={input} value={draft.name} onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))} />
              {fieldErrors.name ? <p className={fieldError}>{fieldErrors.name}</p> : null}
            </label>
            <label className={field}>
              <span>Munkakör / tantárgy</span>
              <input className={input} value={draft.role} onChange={(event) => setDraft((c) => ({ ...c, role: event.target.value }))} />
            </label>
          </div>

          <div className={formRow}>
            <label className={field}>
              <span>E-mail</span>
              <input className={input} value={draft.email ?? ""} onChange={(event) => setDraft((c) => ({ ...c, email: event.target.value || null }))} />
            </label>
            <label className={field}>
              <span>Terem</span>
              <input className={input} value={draft.room ?? ""} onChange={(event) => setDraft((c) => ({ ...c, room: event.target.value || null }))} />
            </label>
          </div>

          <div className={field}>
            <span>Fotó</span>
            <ImageField value={draft.photo} onChange={(photo) => setDraft((c) => ({ ...c, photo }))} />
          </div>

          <div className={formRow}>
            <label className={field}>
              <span>Sorrend</span>
              <input
                className={input}
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(event) => setDraft((c) => ({ ...c, sortOrder: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className={`${checkbox} self-end`}>
              <input type="checkbox" checked={draft.published} onChange={(event) => setDraft((c) => ({ ...c, published: event.target.checked }))} />
              Publikált
            </label>
          </div>

          <button className={buttonPrimary} type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {editingId ? "Mentés" : "Tanár létrehozása"}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
