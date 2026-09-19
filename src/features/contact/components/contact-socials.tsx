import { Code, Contact, Mail, Send } from "lucide-react";

import { fa, site } from "@/content/fa";

import { CopyEmailButton } from "./copy-email-button";
import { Magnetic } from "./magnetic";

/**
 * Direct channels as magnetic pills with lucide glyphs.
 *
 * Rendered **below** the form: the invitation funnels to the form first, and
 * these are the quiet alternative for visitors who would rather reach out
 * directly. This lucide version ships no brand icons (removed upstream), so
 * each channel gets an honest functional mark instead of a wrong metaphor:
 * the paper plane for Telegram, source code for GitHub, an address card for
 * LinkedIn, an envelope for email. Names stay Latin mono next to the mark.
 * Every entry is optional — unconfigured channels are omitted rather than
 * linked somewhere dead (see `site.contact`).
 */
const SOCIALS: {
  key: "github" | "linkedin" | "telegram";
  name: string;
  Icon: typeof Mail;
}[] = [
  { key: "github", name: "GitHub", Icon: Code },
  { key: "linkedin", name: "LinkedIn", Icon: Contact },
  { key: "telegram", name: "Telegram", Icon: Send },
];

const PILL_CLASS =
  "inline-flex h-12 items-center gap-2.5 rounded-full border border-border/70 bg-white/[0.02] px-5 font-mono text-sm transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-cyan-700/50 hover:text-cyan-700 hover:shadow-[0_0_28px_-8px_var(--primary)] focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-cyan-300/50 dark:hover:text-cyan-200";

export function ContactSocials() {
  const { email, ...profiles } = site.contact;
  const configured = SOCIALS.filter((social) => profiles[social.key]);

  if (!email && configured.length === 0) return null;

  return (
    <div data-reveal className="mt-12 text-center sm:mt-14">
      <p className="text-muted-foreground mb-5 text-[11px]">
        {fa.contact.findMe}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {configured.map(({ key, name, Icon }) => (
          <Magnetic key={key} strength={0.35}>
            <a
              href={profiles[key]}
              target="_blank"
              rel="noopener noreferrer"
              className={PILL_CLASS}
            >
              <Icon aria-hidden className="size-4.5" />
              <span dir="ltr" lang="en">
                {name}
              </span>
            </a>
          </Magnetic>
        ))}

        {email && (
          <Magnetic strength={0.35}>
            <a href={`mailto:${email}`} className={PILL_CLASS}>
              <Mail aria-hidden className="size-4.5" />
              <span dir="ltr" lang="en">
                Email
              </span>
            </a>
          </Magnetic>
        )}

        {/* Copy action at the same 48px target as the pills — the button
            renders its own pill with a text label that swaps to the outcome. */}
        {email && (
          <Magnetic strength={0.35}>
            <CopyEmailButton email={email} />
          </Magnetic>
        )}
      </div>
    </div>
  );
}
