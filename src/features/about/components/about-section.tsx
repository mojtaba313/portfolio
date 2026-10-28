import Link from "next/link";
import {
  BookOpen,
  BrainCircuit,
  Briefcase,
  Clapperboard,
  Code2,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { Section } from "@/components/section";
import { fa } from "@/content/fa";
import { SECTION_IDS } from "@/lib/sections";

/**
 * About: the story of how I got here, told as a timeline.
 *
 * A biography reads better chronologically than as a list of values, so the
 * narrative opens the section and the timeline carries the turning points:
 * the quarantine that started everything, the internship, the exam-year pause,
 * and the return to code alongside medicine.
 *
 * Everything here is a server component and static copy: the section is text,
 * and the only interactive part is the anchor at the end. No client
 * JavaScript is spent on telling someone who I am.
 */

/** One icon per timeline entry, in the same order as the copy. */
const TIMELINE_ICONS: LucideIcon[] = [
  Clapperboard,
  Code2,
  Briefcase,
  BookOpen,
  Stethoscope,
  BrainCircuit,
];

/** Right-to-left typography: Persian needs more leading than the Latin default. */
const PROSE = "leading-[2.2] text-[15px]";

export function AboutSection() {
  return (
    <Section id={SECTION_IDS.about} title={fa.home.aboutTitle} subtitle={fa.home.aboutSubtitle}>
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Narrative */}
        <div className="space-y-5">
          {fa.home.aboutLead.map((paragraph) => (
            <p
              key={paragraph.slice(0, 24)}
              data-reveal
              className={`text-muted-foreground ${PROSE}`}
            >
              {paragraph}
            </p>
          ))}

          <div className="pt-4">
            <h3 className="mb-4 text-sm font-medium">{fa.home.aboutTimelineTitle}</h3>
            <ol className="space-y-5">
              {fa.home.aboutTimeline.map((entry, index) => {
                const Icon = TIMELINE_ICONS[index] ?? Code2;
                const isLast = index === fa.home.aboutTimeline.length - 1;
                return (
                  <li key={entry.period} data-reveal className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="border-border/70 text-primary/80 bg-background flex size-9 shrink-0 items-center justify-center rounded-full border">
                        <Icon aria-hidden className="size-4" />
                      </span>
                      {!isLast && <span aria-hidden className="bg-border/70 mt-2 w-px flex-1" />}
                    </div>
                    <div className="pb-2">
                      <p className="text-primary/80 text-[11px] font-medium">{entry.period}</p>
                      <p className="mt-1 text-sm font-medium">{entry.title}</p>
                      <p className={`text-muted-foreground mt-1 text-sm ${PROSE}`}>
                        {entry.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* The next step, as a closing paragraph with the only link in the section */}
          <div
            data-reveal
            className="border-primary/30 bg-primary/5 rounded-2xl border p-5"
          >
            <h3 className="mb-2 text-sm font-medium">{fa.home.aboutNowTitle}</h3>
            <p className={`text-muted-foreground mb-4 text-sm ${PROSE}`}>
              {fa.home.aboutNowBody}
            </p>
            <Link
              href={`#${SECTION_IDS.contact}`}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              {fa.home.aboutNowCta}
              <span aria-hidden className="text-base leading-none">
                ←
              </span>
            </Link>
          </div>
        </div>

        {/* Facts card — the scannable half */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <dl className="border-border/70 divide-border/70 divide-y rounded-2xl border">
            {fa.home.aboutFacts.map((fact) => (
              <div key={fact.label} className="px-4 py-3">
                <dt className="text-muted-foreground text-[11px]">{fact.label}</dt>
                <dd
                  className={`mt-1 text-sm ${
                    // The stack is Latin inside Persian prose; let it keep its
                    // own direction rather than being reordered by the bidi
                    // algorithm mid-sentence.
                    fact.value.includes("·") ? "font-mono text-[13px]" : ""
                  }`}
                  dir={fact.value.includes("·") ? "ltr" : undefined}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </Section>
  );
}
