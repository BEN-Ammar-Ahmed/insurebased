import { describe, expect, it } from "vitest";
import { describeFailure } from "./failures";

describe("describeFailure", () => {
  it("keeps specific server messages", () => {
    expect(describeFailure("rate_limited", true)).toMatchObject({ kind: "error", title: "Too many requests" });
  });

  it("says offline when the device has no connection", () => {
    expect(describeFailure("timeout", false)).toEqual({
      kind: "offline",
      title: "You're offline",
      body: "Check your internet connection and try again.",
    });
  });

  it("falls back to a plain message for unknown failures", () => {
    expect(describeFailure("request_failed", true)).toEqual({
      kind: "error",
      title: "Something went wrong on our end",
      body: "Try again in a moment.",
    });
  });
});
