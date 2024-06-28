import { _withBaseLogger, tokens } from "mini-parse";
import { logCatch, testParse } from "mini-parse/test-util";

import { expect, test } from "vitest";
import { ImportElem, ModuleElem, TemplateElem } from "../AbstractElems.js";
import { argsTokens } from "../MatchWgslD.js";
import {
  directive,
  importing,
  lineCommentOptDirective,
} from "../ParseDirective.js";
import { parseWgslD } from "../ParseWgslD.js";
import { testAppParse } from "./TestUtil.js";

test("directive parses #export", () => {
  const { appState } = testAppParse(directive, "#export");
  expect(appState[0].kind).equals("export");
});

test("parse #export", () => {
  const parsed = parseWgslD("#export");
  expect(parsed[0].kind).equals("export");
});

test("parse #import foo", () => {
  const parsed = parseWgslD("#import foo");
  expect(parsed).toMatchSnapshot();
});

test("parse #import foo(a,b) as baz from bar", () => {
  const parsed = parseWgslD("#import foo as baz from bar");
  expect(parsed).toMatchSnapshot();
});

test("lineComment parse // #export ", () => {
  const src = "// #export ";
  const { position, appState: app } = testParse(lineCommentOptDirective, src);
  expect(position).eq(src.length);
  expect(app).toMatchSnapshot();
});

test("lineCommentOptDirective parses #export(foo) with trailing space", () => {
  const src = `// #export (Elem)    `;
  const result = testAppParse(lineCommentOptDirective, src);
  expect(result.appState[0].kind).eq("export");
});

test("parse #export(foo) with trailing space", () => {
  const src = `
    // #export (Elem) 
  `;

  const parsed = parseWgslD(src);
  expect(parsed).toMatchSnapshot();
});

test("importing parses importing bar(A) fog(B)", () => {
  const src = ` importing bar(A), fog(B)`;
  const { parsed } = testAppParse(tokens(argsTokens, importing), src);
  expect(parsed?.tags.importing).toMatchSnapshot();
});

test("parse #export(A, B) importing bar(A)", () => {
  const src = `
    #export(A, B) importing bar(A)
    fn foo(a:A, b:B) { bar(a); }
  `;
  const parsed = parseWgslD(src);
  expect(parsed[0]).toMatchSnapshot();
});
test("#export w/o closing paren", () => {
  const src = `#export (A
    )
    `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => parseWgslD(src));
  expect(logged()).toMatchInlineSnapshot(`
    "expected text ')''
    #export (A   Ln 1
              ^"
  `);
});

test("parse #extends", () => {
  const src = `#extends Foo(a,b) as Bar from baz`;
  const appState = parseWgslD(src);
  expect(appState[0]).toMatchInlineSnapshot(`
    {
      "args": [
        "a",
        "b",
      ],
      "as": "Bar",
      "end": 33,
      "from": "baz",
      "kind": "extends",
      "name": "Foo",
      "start": 0,
    }
  `);
});

test("parse #module foo.bar.ca", () => {
  const src = `#module foo.bar.ca`;
  const appState = parseWgslD(src);
  expect(appState[0].kind).eq("module");
  expect((appState[0] as ModuleElem).name).eq("foo.bar.ca");
});

test("parse import with numeric types", () => {
  const nums = "1u 2.0F 0x010 -7.0 1e7".split(" ");
  const src = `#import foo(${nums.join(",")})`;
  const appState = parseWgslD(src);
  expect((appState[0] as ImportElem).args).deep.eq(nums);
});

test("parse template", () => {
  const src = `#template foo.cz/magic-strings`;
  const appState = parseWgslD(src);
  expect((appState[0] as TemplateElem).name).deep.eq("foo.cz/magic-strings");
});

test("parse import relpath", () => {
  const src = `#import foo from ./util`;
  const appState = parseWgslD(src);
  const importElem = appState[0] as ImportElem;
  expect(importElem.from).eq("./util");
});

test('import { foo } from "./bar"', (ctx) => {
  const appState = parseWgslD(ctx.task.name);
  const importElem = appState[0] as ImportElem;

  expect(importElem.from).eq("./bar");
});

test('import { foo, bar } from "./bar"', (ctx) => {
  const appState = parseWgslD(ctx.task.name);
  const imports = appState.filter((e) => e.kind === "import") as ImportElem[];
  expect(imports).length(2);
  imports.forEach((importElem) => {
    expect(importElem.from).eq("./bar");
  });
});
