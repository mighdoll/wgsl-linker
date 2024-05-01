import { dlog } from "berry-pretty";
import { FoundRef, TextRef } from "./TraverseRefs.js";
import { AbstractElem, CallElem } from "./AbstractElems.js";

export function printRef(r: FoundRef, msg = ""): void {
  const { kind, elem, rename } = r as TextRef;
  dlog(
    msg,
    {
      kind,
      rename,
    },
    elemToText("elem", elem)
  );
}

export function elemToText(msg: string, elem?: AbstractElem): string {
  if (!elem) return "";
  const { kind, ref: link, name = "" } = elem as CallElem;
  return `${msg}: {kind: ${kind}, name: ${name}, link: ${link !== undefined}}`;
}
