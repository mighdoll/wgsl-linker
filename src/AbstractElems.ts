/** Structures for the abstract syntax tree constructed by the parser. */

export type AbstractElem =
  | ImportElem
  | ExportElem
  | FnElem
  | CallElem
  | StructElem
  | StructMemberElem
  | TypeRefElem;

/** 'interesting' elements found in the source */
export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface CallElem extends AbstractElemBase {
  kind: "call";
  call: string;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  name: string;
  children: CallElem[];
  returnType?: string;
  typeRefs?: TypeRefElem[];
}

export interface TypeRefElem extends AbstractElemBase {
  kind: "typeRef";
  name: string;
}

export interface StructElem extends AbstractElemBase {
  kind: "struct";
  name: string;
  members?: StructMemberElem[];
}

export interface StructMemberElem extends AbstractElemBase {
  kind: "member";
  name: string;
  memberType: string;
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  name?: string; // TODO drop this?
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
