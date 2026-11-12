import { LogIn } from "lucide-react";
import { useNavigate } from "react-router";
import {
  FieldError,
  SubmitButton,
  useFieldErrors,
  useFormSubmit,
} from "../components/auth-ui";
import { authClient } from "../lib/auth-client";
import { loginSchema } from "../lib/schemas";
import { field, form, formError, input } from "../lib/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const { errors, apply, clear } = useFieldErrors();

  const { pending, formError: submitError, onSubmit } = useFormSubmit(async (data) => {
    clear();
    const parsed = loginSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });

    if (!parsed.success) {
      apply(parsed.error);
      return;
    }

    const { error } = await authClient.signIn.email(parsed.data);
    if (error) throw new Error(error.message || "Sikertelen bejelentkezés");
    navigate("/", { replace: true });
  });

  return (
    <div className="grid min-h-screen place-items-center bg-cream p-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-line-soft bg-surface p-8 shadow-2xl">
        <div className="mb-6">
          <img className="w-[168px]" src="/img/logo-208.png" alt="Petrik Lajos Két Tanítási Nyelvű Technikum" />
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Belépés</h1>
        <p className="mb-5 mt-1.5 text-sm text-soft">
          Adminisztrációs felület. Új fiókot csak adminisztrátor hozhat létre.
        </p>

        <form className={form} onSubmit={onSubmit} noValidate>
          {submitError ? (
            <p className={formError} role="alert">
              {submitError}
            </p>
          ) : null}

          <label className={field}>
            <span>E-mail</span>
            <input
              className={input}
              name="email"
              type="email"
              autoComplete="username"
              placeholder="admin@petrik.hu"
              autoFocus
            />
            <FieldError message={errors.email} />
          </label>

          <label className={field}>
            <span>Jelszó</span>
            <input
              className={input}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <FieldError message={errors.password} />
          </label>

          <SubmitButton pending={pending}>
            <LogIn className="size-4" aria-hidden /> Belépés
          </SubmitButton>
        </form>

        <p className="mt-4 border-t border-line-soft pt-4 text-[12.5px] leading-relaxed text-faint">
          A kezdeti admin fiókot a szerver hozza létre az ADMIN_EMAIL és ADMIN_PASSWORD környezeti
          változókból; ez a fiók nem törölhető.
        </p>
      </div>
    </div>
  );
}
