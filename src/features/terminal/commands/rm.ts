import type { Command } from "./types";

export const rmCommand: Command = {
  name: "rm",
  usage: "rm [anything]",
  description: "Delete something. (e.g., rm -rf /)",
  run: (args, ctx) => {
    const target = args.join(" ");
    if (/(^|\s)(-(rf?|fr)|--recursive|--force)($|\s)/.test(` ${target} `) && target.includes("/")) {
      ctx.printMany([
        { kind: "error", text: "Whoa. This portfolio took weeks to build. Not today." },
        { kind: "muted", text: "Try `sudo` if you feel dangerous. (It won't help.)" },
      ]);
      return;
    }
    ctx.printMany([
      { kind: "error", text: `rm: refusing to delete ${target || "the void"}. Everything here is beautiful.` },
      { kind: "muted", text: "Deletions are disabled. Additions (like hiring Mojtaba) are encouraged — see `hire`." },
    ]);
  },
};
