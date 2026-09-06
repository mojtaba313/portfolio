import { fa } from "@/content/fa";
import { formatNumber } from "@/lib/format-number";
import { cn } from "@/lib/utils";

import type { ContributionDay } from "../lib/schema";

/**
 * Contribution heatmap.
 *
 * A server component: the data is already in Postgres and the grid is static, so
 * shipping a client bundle for it would buy nothing. Rendered as a CSS grid of
 * `<div>`s rather than SVG — at ~370 cells the DOM cost is trivial, and it keeps
 * the cells stylable with theme tokens and focusable for keyboard users.
 *
 * Direction is forced LTR. The rest of the page is RTL, but this is the
 * recognisable GitHub calendar and its month labels read left to right; mirroring
 * it would make a familiar visual unfamiliar for no gain. Bidi isolation comes
 * from the wrapper so the dates inside cannot reorder against Persian text
 * around them.
 */

/** Grid rows, Sunday-first to match GitHub's own calendar. */
const DAYS_IN_WEEK = 7;

export function ContributionHeatmap({
  days,
  total,
}: {
  days: ContributionDay[];
  total: number;
}) {
  if (days.length === 0) return null;

  /*
   * Regroup the flat day list into week columns. The cache stores a chronological
   * list precisely so this layout decision lives here rather than in the stored
   * shape — a different grid arrangement later needs no re-fetch.
   *
   * The first column is padded so that row position always equals day-of-week;
   * without this the whole grid shifts whenever the year does not start on a
   * Sunday.
   */
  const firstDayOfWeek = new Date(days[0]!.date).getUTCDay();
  const cells: (ContributionDay | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...days,
  ];

  const weeks: (ContributionDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += DAYS_IN_WEEK) {
    weeks.push(cells.slice(i, i + DAYS_IN_WEEK));
  }

  return (
    <figure className="space-y-3">
      <figcaption className="text-muted-foreground text-sm">
        {fa.github.contributionsTotal(formatNumber(total))}
      </figcaption>

      <div dir="ltr" className="overflow-x-auto pb-2" style={{ unicodeBidi: "isolate" }}>
        {/*
         * role="img" with a single summary label: 370 individually-announced
         * cells would be unusable with a screen reader, and the total in the
         * caption already carries the meaning. Sighted keyboard users still get
         * per-day detail through the native title tooltips.
         */}
        <div
          role="img"
          aria-label={fa.github.heatmapLabel(formatNumber(total))}
          className="flex gap-[3px]"
        >
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) => {
                const day = week[dayIndex];

                if (!day) {
                  // Padding cell: keeps the row alignment without implying zero
                  // contributions on a date outside the range.
                  return (
                    <div
                      key={dayIndex}
                      className="size-[10px] rounded-[2px]"
                      aria-hidden
                    />
                  );
                }

                return (
                  <div
                    key={day.date}
                    // Native tooltip rather than a JS one: no bundle, no
                    // positioning logic, and it works before hydration.
                    title={`${day.date}: ${day.count}`}
                    className={cn(
                      "size-[10px] rounded-[2px] transition-colors",
                      LEVEL_CLASSES[day.level],
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend, mirroring the same scale the cells use. */}
      <div dir="ltr" className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">
          {fa.github.legendLess}
        </span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            aria-hidden
            className={cn("size-[10px] rounded-[2px]", LEVEL_CLASSES[level])}
          />
        ))}
        <span className="text-muted-foreground text-xs">
          {fa.github.legendMore}
        </span>
      </div>
    </figure>
  );
}

/**
 * Intensity scale.
 *
 * Built from `--primary` at increasing opacity rather than from a fixed green.
 * That keeps the heatmap inside the theme and means it adapts when the palette is
 * set later, instead of being a hardcoded colour to hunt down. Level 0 uses the
 * muted surface so empty days read as background, not as data.
 */
const LEVEL_CLASSES: Record<number, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};
