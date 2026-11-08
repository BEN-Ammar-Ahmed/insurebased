// Guards the design rules in docs/DESIGN_SYSTEM.md that are easy to break by
// accident: the token values, no hardcoded colors in components, no looping
// animations, no display font, and no Next.js dev badge.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const css = read("app/globals.css");

const TOKENS: Record<string, string> = {
  "--primary": "#1d4f91",
  "--primary-press": "#163d72",
  "--ink": "#14263d",
  "--muted": "#4d5d70",
  "--bg": "#f5f8fc",
  "--surface": "#ffffff",
  "--line": "#dde5ef",
  "--tint": "#e9f0f9",
  "--ok-bg": "#e3f2e8",
  "--ok-ink": "#1d6b3e",
  "--danger": "#a12b38",
  "--danger-bg": "#fbecee",
};

function tsxFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (statSync(path.join(root, rel)).isDirectory()) return tsxFiles(rel);
    return rel.endsWith(".tsx") ? [rel] : [];
  });
}

describe("design contract", () => {
  it("defines every color token with its exact value", () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(css, name).toContain(`${name}: ${value};`);
    }
  });

  it("only animates the search panel opening, and never loops", () => {
    const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(keyframes).toEqual(["panel-open"]);
    expect(css).not.toMatch(/\binfinite\b/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("uses only the 400 and 600 font weights", () => {
    expect(css).not.toMatch(/font-weight:\s*(700|800|900|bold)/);
  });

  it("uses one font family, with no display font", () => {
    const layout = read("app/layout.tsx");
    expect(layout.toLowerCase()).not.toContain("fraunces");
    expect(layout).not.toContain("font-display");
    expect(css).not.toContain("font-display");
    expect(read("package.json")).not.toContain("@fontsource/fraunces");
    expect(layout).toContain('themeColor: "#1d4f91"');
  });

  it("hides the Next.js dev indicator", () => {
    expect(read("next.config.ts")).toContain("devIndicators: false");
  });

  it("keeps hex colors out of components and pages", () => {
    const hex = /(?<![\w&])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/;
    const offenders = [...tsxFiles("components"), ...tsxFiles("app")]
      .filter((file) => !file.replace(/\\/g, "/").endsWith("app/global-error.tsx"))
      .filter((file) =>
        read(file)
          .split("\n")
          .some((line) => hex.test(line) && !line.includes('themeColor: "#1d4f91"'))
      );
    expect(offenders).toEqual([]);
  });
});
