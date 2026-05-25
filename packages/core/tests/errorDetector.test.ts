import { describe, expect, it } from "vitest";
import { classify, stripTimestamp } from "../src/logs/errorDetector";
import { LogParser } from "../src/logs/logParser";

describe("classify", () => {
  it("flags npm ERR! as error", () => {
    expect(classify("npm ERR! missing script: build").severity).toBe("error");
  });

  it("flags pnpm ELIFECYCLE as error", () => {
    expect(classify("ELIFECYCLE  Test failed. See above for more details.").severity).toBe("error");
  });

  it("flags Laravel Illuminate exception", () => {
    expect(classify("Illuminate\\Database\\QueryException SQLSTATE[42S02]").severity).toBe("error");
  });

  it("flags TypeScript error format", () => {
    expect(classify("src/index.ts(10,5): error TS2304: Cannot find name 'foo'.").severity).toBe("error");
  });

  it("flags ESLint error rows", () => {
    expect(classify("  10:5  error  'foo' is not defined  no-undef").severity).toBe("error");
  });

  it("flags docker build failure", () => {
    expect(classify("ERROR: failed to solve: dockerfile parse error").severity).toBe("error");
  });

  it("flags GitHub Actions exit code line", () => {
    expect(classify("Process completed with exit code 2.").severity).toBe("error");
  });

  it("classifies warnings as warning, not error", () => {
    expect(classify("warning: package x is deprecated").severity).toBe("warning");
    expect(classify("  warn deprecated package@1.0.0").severity).toBe("warning");
  });

  it("treats a clean log line as info", () => {
    expect(classify("All tests passed!").severity).toBe("info");
    expect(classify("> jest --ci").severity).toBe("info");
  });

  it("strips GitHub timestamps before matching", () => {
    expect(stripTimestamp("2026-01-02T03:04:05.678Z npm ERR! boom"))
      .toBe("npm ERR! boom");
    expect(classify("2026-01-02T03:04:05.678Z npm ERR! boom").severity).toBe("error");
  });
});

describe("LogParser", () => {
  it("returns an empty result for empty input", () => {
    const parsed = new LogParser().parse("");
    expect(parsed.errorLineNumbers).toEqual([]);
    expect(parsed.firstErrorLine).toBeNull();
  });

  it("collects error line numbers and a first-error pointer", () => {
    const parsed = new LogParser({ contextLines: 1 }).parse(
      [
        "Starting build",
        "compiling foo.ts",
        "src/foo.ts(1,1): error TS2304: Cannot find name 'bar'.",
        "compilation failed",
        "Done in 2.34s",
      ].join("\n"),
    );
    expect(parsed.errorLineNumbers).toContain(3);
    expect(parsed.firstErrorLine).toBe(3);
    expect(parsed.errorBlocks[0]?.preview).toContain("error TS2304");
  });

  it("respects maxLines by keeping the tail", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const parsed = new LogParser({ maxLines: 10 }).parse(lines.join("\n"));
    expect(parsed.lines).toHaveLength(10);
    expect(parsed.lines[0]?.text).toBe("line 91");
  });

  it("groups contiguous error lines into one block", () => {
    const parsed = new LogParser({ contextLines: 0 }).parse(
      [
        "error: first",
        "error: second",
        "error: third",
        "all done",
      ].join("\n"),
    );
    expect(parsed.errorBlocks).toHaveLength(1);
    expect(parsed.errorBlocks[0]?.lineNumbers).toEqual([1, 2, 3]);
  });
});
