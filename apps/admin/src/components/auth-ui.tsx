import { Loader2 } from "lucide-react";
import type { ReactNode, SubmitEvent } from "react";
import { useState } from "react";
import { z } from "zod";
import { buttonBlock, buttonPrimary, fieldError } from "../lib/ui";

type FieldErrors = Record<string, string | undefined>;

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={fieldError}>{message}</p>;
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button className={`${buttonPrimary} ${buttonBlock}`} type="submit" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});

  const apply = (error: z.ZodError) => {
    const flattened = z.flattenError(error);
    setErrors(flattened.fieldErrors as FieldErrors);
  };

  return { errors, apply, clear: () => setErrors({}) };
}

export function useFormSubmit(handler: (data: FormData) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setPending(true);
    try {
      await handler(new FormData(event.currentTarget));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  return { pending, formError, onSubmit, clearError: () => setFormError(null) };
}
