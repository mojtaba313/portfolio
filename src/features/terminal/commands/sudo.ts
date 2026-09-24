import { hireCommand } from "./hire";
import type { Command } from "./types";

const REFUSALS = [
  "Nice try. There is no root here — only Mojtaba, and he answers to no password.",
  "Permission denied: this terminal runs on curiosity, not privileges.",
  "sudo: guest is not in the sudoers file. This incident will be reported... to Mojtaba. He says hi.",
];

/**
 * The mandatory joke command. Refuses with rotating quips — except for the
 * one invocation that matters.
 */
export const sudoCommand: Command = {
  name: "sudo",
  usage: "sudo [hire mojtaba]",
  description: "Try to gain superpowers. Go on, try :)",
  run: (args, ctx) => {
    const [first, second] = args.map((a) => a.toLowerCase());

    if (first === "hire" && (second === undefined || second === "mojtaba")) {
      ctx.printMany([
        { kind: "output", text: "Permission granted. Excellent choice." },
      ]);
      hireCommand.run([], ctx);

      return;
    }

    const pick = REFUSALS[Math.floor(Math.random() * REFUSALS.length)]!;
    ctx.printMany([
      { kind: "error", text: pick },
      {
        kind: "muted",
        text: "Tip: `sudo hire mojtaba` is the only sudo that works here.",
      },
    ]);
  },
};
