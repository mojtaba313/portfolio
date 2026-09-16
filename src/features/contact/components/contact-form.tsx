"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fa } from "@/content/fa";
import {
  CONTACT_LIMITS,
  contactSchema,
  type ContactData,
  type ContactInput,
  type ContactResult,
} from "@/lib/validation/contact";

import { submitContactForm } from "../actions";
import { Magnetic } from "./magnetic";

/**
 * Contact form.
 *
 * Validates on the client through the same Zod schema the Server Action parses
 * with, so the two can never disagree about what is valid.
 *
 * The action is called directly rather than through `<form action={...}>` and
 * `useActionState`, because RHF already owns the form state and mixing the two
 * means two sources of truth for the same fields. The trade-off is losing
 * no-JavaScript progressive enhancement — acceptable for a form that sits on a
 * page whose headline features are a canvas graph and a WebGL scene.
 */
export function ContactForm() {
  /** Outcome of the last submit; null before the first attempt. */
  const [result, setResult] = useState<ContactResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  /*
   * Three generics, not one: the schema's `subject` transform turns "" into null,
   * so the parsed output type differs from the form's input type. RHF models that
   * with <TFieldValues, TContext, TTransformedValues> — without the third,
   * zodResolver's output does not typecheck against the form values, and
   * handleSubmit would hand the action untransformed data.
   */
  } = useForm<ContactInput, unknown, ContactData>({
    resolver: zodResolver(contactSchema),
    // Validate as fields are left rather than on every keystroke: mid-typing
    // "contact is invalid" on a half-entered address is noise, not help.
    mode: "onBlur",
    defaultValues: { name: "", email: "", subject: "", message: "", botField: "" },
  });

  // Receives the *parsed* values, so `subject` is already null rather than "".
  const onSubmit = async (values: ContactData) => {
    const outcome = await submitContactForm(values);
    setResult(outcome);

    if (outcome.status === "success") {
      reset();
      return;
    }

    /*
     * Server-side validation failures are mapped back onto the fields. In
     * practice the client schema catches these first, so this path only runs
     * when the two somehow disagree — but silently dropping field errors would
     * leave the user with a generic banner and no idea which input to fix.
     */
    if (outcome.reason === "validation" && outcome.fieldErrors) {
      for (const [field, message] of Object.entries(outcome.fieldErrors)) {
        setError(field as keyof ContactInput, { type: "server", message });
      }
    }
  };

  const isSuccess = result?.status === "success";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {/*
       * Honeypot. Hidden from sight and from assistive tech, and excluded from
       * the tab order, so no real user can reach it — while a bot that fills
       * every input gets rejected server-side.
       *
       * `sr-only` rather than an off-screen offset like `-left-[9999px]`. That
       * offset was the cause of a real bug: absolutely positioned content that
       * far left creates leftward scrollable overflow, and on this RTL document
       * Chrome makes that scrollable — a ~10000px horizontal scrollbar on every
       * page with the form. `sr-only` is clip-based rather than `display: none`,
       * so naive bots still see a rendered field, with zero layout impact.
       */}
      <div aria-hidden className="sr-only">
        <label htmlFor="botField">Leave this empty</label>
        <input
          id="botField"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("botField")}
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field
          id="name"
          label={fa.contact.name}
          error={errors.name?.message}
          required
        >
          <Input
            id="name"
            maxLength={CONTACT_LIMITS.nameMax}
            autoComplete="name"
            aria-invalid={!!errors.name}
            
            className={FIELD_CLASS}
            {...register("name")}
          />
        </Field>

        <Field
          id="email"
          label={fa.contact.email}
          error={errors.email?.message}
          required
        >
          {/*
            * dir="ltr" because the value is Latin either way: inside an RTL
            * field the bidi algorithm moves the leading "@" of an email — or
            * the leading "+" of a phone number — to the wrong end while
            * typing, which looks broken even though the value is fine.
            * type="text" (not "email") so mobile keyboards and native
            * validation don't assume the value is always an address; the Zod
            * schema above is the only validator. No autoComplete token covers
            * an either-or field, so none is set rather than a misleading one.
            */}
          <Input
            id="email"
            type="text"
            dir="ltr"
            autoComplete="off"
            aria-invalid={!!errors.email}
            
            className={FIELD_CLASS}
            {...register("email")}
          />
        </Field>
      </div>

      <Field id="subject" label={fa.contact.subject} error={errors.subject?.message}>
        <Input
          id="subject"
          maxLength={CONTACT_LIMITS.subjectMax}
          aria-invalid={!!errors.subject}
          
          className={FIELD_CLASS}
          {...register("subject")}
        />
      </Field>

      <Field
        id="message"
        label={fa.contact.message}
        error={errors.message?.message}
        required
      >
        <Textarea
          id="message"
          rows={5}
          maxLength={CONTACT_LIMITS.messageMax}
          aria-invalid={!!errors.message}
          
          className={FIELD_CLASS}
          {...register("message")}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        {/*
         * Magnetic like the CTA above and the social pills below: the submit
         * is the moment of sending, so it gets the same pull. Same pill
         * language as the CTA (h-13, rounded-full, primary glow) so the two
         * primary actions read as one voice. A disabled button fires no
         * pointer events, so the magnet naturally rests while submitting.
         */}
        <Magnetic strength={0.3}>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="h-13 gap-2.5 rounded-full px-8 text-base font-semibold shadow-[0_0_36px_-8px_var(--primary)] hover:shadow-[0_0_54px_-6px_var(--primary)]"
          >
            {isSubmitting ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-5" aria-hidden />
            )}
            {isSubmitting ? fa.contact.sending : fa.contact.submit}
          </Button>
        </Magnetic>

        {/*
         * One live region for both outcomes, so a screen reader announces the
         * result without the focus moving. `assertive` for errors because a
         * failed submit is something the user must act on.
         */}
        {result && (
          <p
            role="status"
            aria-live={isSuccess ? "polite" : "assertive"}
            className={
              isSuccess
                ? "text-success text-sm font-medium"
                : "text-destructive text-sm font-medium"
            }
          >
            {isSuccess ? fa.contact.success : result.message}
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * Elevated boxed fields for the finale.
 *
 * Roomy, softly-surfaced inputs with a cyan focus halo instead of the default
 * ring — the glow is the same energy as the orb above, so the form reads as
 * part of the transmission rather than a separate widget. `focus-visible:ring-0`
 * is load-bearing: the base inputs ship `focus-visible:ring-3`, and without
 * cancelling it the custom halo shadow would fight the ring in the cascade.
 * Error states are untouched — the base destructive border still wins on
 * invalid fields.
 */
const FIELD_CLASS =
  "h-13 rounded-xl border-border/70 bg-white/[0.02] px-4 text-base transition-all duration-300 placeholder:text-muted-foreground/50 hover:border-foreground/25 focus-visible:border-cyan-300/60 focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(34,211,238,0.12)] dark:bg-white/[0.03]";

/**
 * Label + control + error message, wired together.
 *
 * Exists so every field gets `aria-describedby` pointing at its error and the
 * label is actually associated with the control — the parts that are easy to
 * forget when each field is written out by hand.
 */
function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>

      {/* Cloned rather than asking each call site to repeat aria-describedby. */}
      {React.isValidElement<{ "aria-describedby"?: string }>(children)
        ? React.cloneElement(children, {
            "aria-describedby": error ? errorId : undefined,
          })
        : children}

      {error && (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
