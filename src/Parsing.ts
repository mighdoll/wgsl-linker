const optComment = /(\s*\/\/)?/;
const exportDirective = /\s*#export\s*/;
const moduleDirective = /\s*#module\s*/;
const ifDirective = /\s*#if\s+/;
const elseDirective = /\s*#else\b/;
const endifDirective = /\s*#endif\b/;
const templateDirective = /\s*#template\s*/;
const importCmd = /\s*#(?<importCmd>(import))\s+/;
const optImportAs = /(\s*as\s+(?<importAs>[\w]+))?/;
const optImportFrom = /(\s*from\s+(?<importFrom>[\w]+))?/;
const endInsert = /\s*#endInsert/;
const endExport = /\s*#endExport/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
const name = /(?<name>[\w]+)/;
const optName = /(?<name>[\w]+)?/;
const optBang = /(?<bang>!)?/;
export const exportRegex = regexConcatI(optComment, exportDirective, optName, optParams);
export const importRegex = regexConcatI(
  optComment,
  importCmd,
  name,
  optParams,
  optImportAs,
  optImportFrom
);
export const endInsertRegex = regexConcatI(optComment, endInsert);
export const endExportRegex = regexConcatI(optComment, endExport);
export const ifRegex = regexConcatI(optComment, ifDirective, optBang, name);
export const endifRegex = regexConcatI(optComment, endifDirective);
export const elseRegex = regexConcatI(optComment, elseDirective);
export const templateRegex = regexConcatI(optComment, templateDirective, name);
export const moduleRegex = regexConcatI(optComment, moduleDirective, name);
export const tokenRegex = /\b(\w+)\b/gi;

const fnOrStruct = /\s*((fn)|(struct))\s*/;
export const fnOrStructRegex = regexConcatI(fnOrStruct, name);

export const fnPrefix = /\bfn\s+/;
const parenStart = /\s*\(\s*/;
export const parenStartAhead = /(?=\s*\()/;
export const fnRegex = regexConcatI(fnPrefix, name, parenStart);
export const fnRegexGlobal = regexConcat("g", fnPrefix, name, parenStart);

export const structPrefix = /\bstruct\s+/;
const braceStart = /\s*{\s*/;
export const braceStartAhead = /(?=\s*{)/;
export const structRegex = regexConcatI(structPrefix, name, braceStart);
export const structRegexGlobal = regexConcat("g", structPrefix, name, braceStart);

export const colonBehind = /(?<=:\s*)/;
export const notFnDecl = /(?<!fn\s+)(?<!@\s*)/;
export const ltBehind = /(?<=<\s*)/;
export const commaOrGtAhead = /(?=\s*(,|>))/;

export function regexConcat(flags: string, ...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, flags);
}

function regexConcatI(...exp: RegExp[]): RegExp {
  return regexConcat("i", ...exp);
}

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}
