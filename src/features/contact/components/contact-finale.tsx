import { fa } from "@/content/fa";

import { ContactForm } from "./contact-form";
import { ContactCta } from "./contact-cta";
import { ContactSocials } from "./contact-socials";

/**
 * Contact finale: the closing invitation, not a form with a header.
 *
 * Composition is deliberately calmer than the sections above — one centred
 * column, type-led, no cards. The invitation leads; the magnetic CTA funnels
 * to the form; magnetic social pills sit below the form as the quiet
 * alternative for visitors who would rather reach out directly. Entrances
 * ride the existing GSAP `data-reveal` system, so no new animation
 * infrastructure.
 *
 * Server component: the interactive islands (CTA, copy button, form) are
 * client components mounted inside it.
 */
export function ContactFinale() {
  return (
    <div data-contact-finale className="relative">
      {/* Invitation */}
      <div className="relative overflow-hidden px-2 pt-10 pb-16 text-center sm:pt-14 sm:pb-20">
        <p data-reveal className="mb-6 flex items-center justify-center gap-3">
          <span
            aria-hidden
            className="bg-primary h-px w-8 shadow-[0_0_8px_var(--primary)]"
          />
          <span
            dir="ltr"
            lang="en"
            className="text-muted-foreground font-mono text-xs tracking-[0.25em]"
          >
            {fa.contact.finaleEyebrow}
          </span>
          <span
            aria-hidden
            className="bg-primary h-px w-8 shadow-[0_0_8px_var(--primary)]"
          />
        </p>

        <h3 data-reveal className="text-4xl font-bold text-balance sm:text-5xl space-y-5">
          {fa.contact.finaleHeadline.map((line, i) =>
            i === fa.contact.finaleHeadline.length - 1 ? (
              <span
                key={line}
                className="text-primary block drop-shadow-[0_0_28px_var(--primary)]"
              >
                {line}
              </span>
            ) : (
              <span key={line} className="block">
                {line}
              </span>
            ),
          )}
        </h3>

        <p
          data-reveal
          className="mt-5 flex items-center justify-center gap-2 text-xs"
        >
          <span className="relative flex size-2">
            <span
              aria-hidden
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
            />
            <span
              aria-hidden
              className="relative inline-flex size-2 rounded-full bg-emerald-400"
            />
          </span>
          <span className="text-muted-foreground">{fa.contact.available}</span>
        </p>

        <p
          data-reveal
          className="text-muted-foreground mx-auto mt-5 max-w-prose text-balance"
        >
          {fa.contact.finaleSub}
        </p>

        <div data-reveal className="mt-9">
          <ContactCta label={fa.contact.startConversation} />
        </div>
      </div>

      {/* The form itself, held by a restrained glass panel — presence through
          depth and air, not chrome. */}
      <div data-reveal className="mx-auto mt-16 max-w-2xl px-2 sm:mt-20">
        <p className="mb-8 flex items-center gap-3">
          <span aria-hidden className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">
            {fa.contact.directMessage}
          </span>
          <span aria-hidden className="bg-border h-px flex-1" />
        </p>
        <div className="rounded-3xl border border-border/70 bg-linear-to-b from-white/4 to-transparent p-6 shadow-[0_0_90px_-45px_rgba(34,211,238,0.45)] sm:p-10">
          <ContactForm />
        </div>
      </div>

      {/* Magnetic social pills, below the form — the quiet alternative for
          visitors who would rather reach out directly. */}
      <div className="mx-auto max-w-2xl px-2">
        <ContactSocials />
      </div>
    </div>
  );
}
