import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LogParser } from "../src/logs/logParser";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("LogParser against real-world fixtures", () => {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".log"));

  for (const file of files) {
    it(`detects at least one error in ${file}`, () => {
      const raw = readFileSync(join(FIXTURES_DIR, file), "utf8");
      const parsed = new LogParser().parse(raw);
      expect(parsed.errorLineNumbers.length).toBeGreaterThan(0);
      expect(parsed.firstErrorLine).not.toBeNull();
      expect(parsed.errorBlocks.length).toBeGreaterThan(0);
    });
  }
});
