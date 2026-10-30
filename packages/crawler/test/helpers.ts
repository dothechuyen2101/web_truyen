import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
