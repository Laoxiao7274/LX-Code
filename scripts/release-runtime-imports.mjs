const NODE_RUNTIME_ENTRYPOINTS = Object.freeze({
  "pdfjs-dist": "pdfjs-dist/legacy/build/pdf.mjs",
});

// 平台特定二进制包(含 node.exe/bin,无 JS 入口),不能被 import。
// proveRuntimeImports 跳过它们(它们通过子进程调用,不是 ES module)。
const PLATFORM_BINARY_PACKAGES = Object.freeze([
  "@colbymchenry/codegraph-win32-x64",
]);

// Pi extension 包:发布纯 .ts 源码(package.json exports → ./index.ts),
// 设计上由 Pi 的 jiti 加载器编译加载,裸 Node 无法直接 import(ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING)。
// LXCode 把它们作为内置 extension 经 DefaultResourceLoader.additionalExtensionPaths 接入,
// proveRuntimeImports 跳过它们(运行时由 jiti 加载,不经裸 Node import)。
const PI_EXTENSION_PACKAGES = Object.freeze([
  "pi-mcp-adapter",
]);

export function releaseRuntimeImportSpecifiers(productionDependencies) {
  return Object.keys(productionDependencies)
    .filter((name) => !PLATFORM_BINARY_PACKAGES.includes(name))
    .filter((name) => !PI_EXTENSION_PACKAGES.includes(name))
    .map((packageName) => NODE_RUNTIME_ENTRYPOINTS[packageName] ?? packageName);
}
