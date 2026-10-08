// Node normally inherits flags while excluding process/V8-only options.
// An explicit execArgv bypasses that filtering, so only override it when
// parent stdin parsing would reject the file worker's module URL.
export function workerExecArgv() {
  if (!process.execArgv.some((arg) => /^--input-type(?:=|$)/.test(arg))) {
    return undefined;
  }
  const retained = [];
  for (let i = 0; i < process.execArgv.length; i++) {
    const arg = process.execArgv[i];
    // Preserve module hooks and permission grants during the override.
    if (
      /^(?:--(?:import|require|loader|experimental-loader|conditions|permission|experimental-permission|allow-[a-z-]+)|-[rC])(?:=|$)/.test(
        arg
      )
    ) {
      retained.push(arg);
      if (!arg.includes('=') && process.execArgv[i + 1]?.[0] !== '-') {
        const value = process.execArgv[i + 1];
        if (value !== undefined) {
          retained.push(process.execArgv[++i]);
        }
      }
    }
  }
  return retained;
}
