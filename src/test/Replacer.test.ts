import {test,expect} from "vitest";
import { replacer } from "../Replacer.js";
import { dlog } from "berry-pretty";

test("parse blank line", () => {
  const src = "";
  const result = replacer(src, {})
  expect(result).eq(src);
})

test("parse line w/o replacement", () => {
  const src = "fn main() { // foo";
  const result = replacer(src, {})
  expect(result).eq(src);
})

test("parse line w/ single replacement", () => {
  const src = "var a = 4; // #replace 4=workSize";
  const result = replacer(src, {workSize:128})
  expect(result).includes("var a = 128;");
});