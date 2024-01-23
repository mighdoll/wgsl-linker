
export let logErr = console.error;

/** use temporary logger for tests */
export function _withErrLogger<T>(logFn: typeof console.error, fn: () => T): T {
  const orig = logErr;
  try {
    logErr = logFn;
    return fn();
  } finally {
    logErr = orig;
  }
}

export function srcErr(src:string, pos:number, msg:string):void {
  logErr(src)
}
