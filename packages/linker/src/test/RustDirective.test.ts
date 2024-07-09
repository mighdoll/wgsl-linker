import { tokens } from "mini-parse";
import { expect, test } from "vitest";
import { argsTokens } from "../MatchWgslD.js";
import { rustImport } from "../RustDirective.js";
import { testAppParse } from "./TestUtil.js";

const testRustImport = tokens(argsTokens, rustImport);

test("import my::lighting::pbr;", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 25,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SimpleSegment {
              "as": undefined,
              "name": "pbr",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import my::lighting::{ pbr };", (ctx) => {
  const { parsed, appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 29,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "pbr",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test(`import my::lighting::{ pbr, jelly };`, (ctx) => {
  const { parsed, appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 36,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "pbr",
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "jelly",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import my::lighting::{ pbr, jelly::jam };", (ctx) => {
  const { parsed, appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 41,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "pbr",
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "jelly",
                    },
                    SimpleSegment {
                      "as": undefined,
                      "name": "jam",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});
