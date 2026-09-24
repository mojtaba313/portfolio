import type { Command } from "./types";

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "There are only 10 kinds of people: those who understand binary and those who don't.",
  "A SQL query walks into a bar, sees two tables and asks… “Mind if I join you?”",
  "Real programmers count from 0. Everyone else is off by one.",
];

export const jokeCommand: Command = {
  name: "joke",
  description: "A moment of levity, on the house.",
  run: (_args, ctx) => {
    const pick = JOKES[Math.floor(Math.random() * JOKES.length)]!;
    ctx.print({ kind: "output", text: pick });
  },
};
