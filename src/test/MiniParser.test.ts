import { expect, test } from "vitest";
import { miniParse } from "../MiniParser.js";

test("parse #import foo", () => {
  const parsed = miniParse("#import foo");
  console.log("parsed result:", parsed);
});
