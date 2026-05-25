import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAiDebugPrompt } from "../src/ai/debugPrompt";
import { LogParser } from "../src/logs/logParser";
import { sanitiseLogText } from "../src/logs/logHighlighter";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

describe("createAiDebugPrompt", () => {
  it("includes repo / branch / workflow context", () => {
    const prompt = createAiDebugPrompt({
      repository: "octocat/hello",
      branch: "main",
      commitSha: "abc123",
      workflowName: "CI",
      jobName: "build",
      failedStepName: "tsc",
      snippet: "src/foo.ts(1,1): error TS2304",
    });
    expect(prompt).toContain("octocat/hello");
    expect(prompt).toContain("Branch: main");
    expect(prompt).toContain("Workflow: CI");
    expect(prompt).toContain("Job: build");
    expect(prompt).toContain("Failed step: tsc");
    expect(prompt).toContain("error TS2304");
  });

  it("prefers parsedLog.errorBlocks over a raw snippet", () => {
    const parsed = new LogParser({ contextLines: 1 }).parse(fixture("typescript-failure.log"));
    const prompt = createAiDebugPrompt({
      repository: "octocat/hello",
      parsedLog: parsed,
      snippet: "should be ignored",
    });
    expect(prompt).toContain("error TS2345");
    expect(prompt).not.toContain("should be ignored");
  });

  it("masks GitHub tokens in the snippet", () => {
    const prompt = createAiDebugPrompt({
      repository: "octocat/hello",
      snippet: "Using token ghp_abcdefghijklmnopqrstuvwxyz0123456789 for auth",
    });
    expect(prompt).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(prompt).toContain("[REDACTED:GITHUB_TOKEN]");
  });

  it("sanitiseLogText masks bearer tokens and AWS keys", () => {
    const masked = sanitiseLogText(
      [
        "Authorization: Bearer abc.def.ghi",
        "aws_access_key_id=AKIAIOSFODNN7EXAMPLE",
        "password='supersecret123'",
      ].join("\n"),
    );
    expect(masked).not.toContain("abc.def.ghi");
    expect(masked).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(masked).not.toContain("supersecret123");
  });
});
