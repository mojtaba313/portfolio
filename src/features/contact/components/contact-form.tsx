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
    // "email is invalid" on a half-entered address is noise, not help.
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
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

      <div className="grid gap-5 sm:grid-cols-2">
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
           * dir="ltr" because an email address is Latin: inside an RTL field the
           * bidi algorithm moves the leading "@" or a trailing dot to the wrong
           * end while typing, which looks broken even though the value is fine.
           */}
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
      </div>

      <Field id="subject" label={fa.contact.subject} error={errors.subject?.message}>
        <Input
          id="subject"
          maxLength={CONTACT_LIMITS.subjectMax}
          aria-invalid={!!errors.subject}
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
          rows={6}
          maxLength={CONTACT_LIMITS.messageMax}
          aria-invalid={!!errors.message}
          {...register("message")}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Send aria-hidden />
          )}
          {isSubmitting ? fa.contact.sending : fa.contact.submit}
        </Button>

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
      <Label htmlFor={id}>
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
