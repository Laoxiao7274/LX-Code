const NODE_RUNTIME_ENTRYPOINTS = Object.freeze({
  "pdfjs-dist": "pdfjs-dist/legacy/build/pdf.mjs",
});

// 平台特定二进制包(含 node.exe/bin,无 JS 入口),不能被 import。
// proveRuntimeImports 跳过它们(它们通过子进程调用,不是 ES module)。
const PLATFORM_BINARY_PACKAGES = Object.freeze([
  "@colbymchenry/codegraph-win32-x64",
]);

export function releaseRuntimeImportSpecifiers(productionDependencies) {
  return Object.keys(productionDependencies)
    .filter((name) => !PLATFORM_BINARY_PACKAGES.includes(name))
    .map((packageName) => NODE_RUNTIME_ENTRYPOINTS[packageName] ?? packageName);
}
