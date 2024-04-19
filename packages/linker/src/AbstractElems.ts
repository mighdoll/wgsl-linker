/** Structures for the abstract syntax tree constructed by the parser. */

export type AbstractElem =
  | ImportElem
  | ExtendsElem
  | ExportElem
  | ModuleElem
  | TemplateElem
  | FnElem
  | NameElem
  | CallElem
  | StructElem
  | StructMemberElem
  | VarElem
  | TypeRefElem;

export type NamedElem = Extract<AbstractElem, { name: string }>;

export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface CallElem extends AbstractElemBase {
  kind: "call";
  name: string;
}

export interface NameElem extends AbstractElemBase {
  kind: "name";
  name: string;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  name: string;
  nameElem: NameElem;
  calls: CallElem[];
  typeRefs: TypeRefElem[];
}

export interface TypeRefElem extends AbstractElemBase {
  kind: "typeRef";
  name: string;
}

export interface StructElem extends AbstractElemBase {
  kind: "struct";
  name: string;
  nameElem?: NameElem; // TODO
  members?: StructMemberElem[];
  typeRefs: TypeRefElem[];
  extendsElems?: ExtendsElem[];
}

export interface StructMemberElem extends AbstractElemBase {
  kind: "member";
  name: string;
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  args?: string[];
  importing?: ImportElem[];
}

export interface ImportElem extends AbstractElemBase {
  kind: "import";
  name: string;
  args?: string[];
  as?: string;
  from?: string;
}

export interface ExtendsElem extends Omit<ImportElem, "kind"> {
  kind: "extends";
  name: string;
  args?: string[];
  as?: string;
  from?: string;
}

export interface ModuleElem extends AbstractElemBase {
  kind: "module";
  name: string;
}

export interface VarElem extends AbstractElemBase {
  kind: "var";
  name: string;
  nameElem?: NameElem; // TODO
  typeRefs: TypeRefElem[];
}

export interface TemplateElem extends AbstractElemBase {
  kind: "template";
  name: string;
}
