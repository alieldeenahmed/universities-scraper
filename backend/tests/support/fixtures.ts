import { readFileSync } from "node:fs";

const DIR = new URL("../fixtures/", import.meta.url);

export function fixtureText(path: string): string {
  return readFileSync(new URL(path, DIR), "utf8");
}

export function fixtureJson<T = any>(path: string): T {
  return JSON.parse(fixtureText(path)) as T;
}
