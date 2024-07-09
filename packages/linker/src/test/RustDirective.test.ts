import { tokens } from "mini-parse";
import { expect, test } from "vitest";
import { argsTokens } from "../MatchWgslD.js";
import { rustImport } from "../RustDirective.js";
import { testAppParse } from "./TestUtil.js";
import { dlogOpt } from "berry-pretty";

const testRustImport = tokens(argsTokens, rustImport);

test("import a::b::c", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("import my::lighting::pbr;", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("import my::lighting::{ pbr };", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test(`import my::lighting::{ pbr, jelly };`, (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("import my::lighting::{ pbr, jelly::jam };", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("import my::lighting::{ pbr as lights }", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("import a::*", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("import a::{b, c}::*", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test("multiline import", () => {
  const src = `import a::
        {b, c}::*;`;
  const { appState } = testAppParse(testRustImport, src);
  expect(appState).toMatchSnapshot();
});
