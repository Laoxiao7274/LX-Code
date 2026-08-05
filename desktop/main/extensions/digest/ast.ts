/**
 * AST 解析 —— 阶段1 内置 CodeKnowledgeProvider。
 *
 * 用 @babel/parser 解析 TS/TSX/JS,提取函数骨架(名字/行号/调用/import),
 * 不调 LLM,不读完整源码语义。白话字段(what/how/pitfalls)阶段1 留空,
 * 由后续迭代接入 LLM 生成。
 *
 * 对齐 Aider repo map 思路:只读结构,不全量读代码。
 */
import { parse } from "@babel/parser";
import * as t from "@babel/types";

/** 支持解析的文件扩展名。 */
export const PARSEABLE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/** 一个函数/方法的结构化骨架(未含白话字段)。 */
export interface FunctionSkeleton {
  fn: string;
  startLine: number;
  endLine: number;
  /** 函数体内调用的符号名(本文件内可解析的)。 */
  calls: string[];
  /** 是否导出(用于启发式判断 entry/core)。 */
  exported: boolean;
  /** 是否含 JSX(启发式判断 ui 级别)。 */
  hasJsx: boolean;
}

/** 一个文件的解析结果。 */
export interface FileSkeleton {
  file: string;
  functions: FunctionSkeleton[];
  /** import 的来源(用于依赖关系)。 */
  imports: string[];
}

/** 判断文件是否可解析。 */
export function isParseable(filePath: string): boolean {
  return PARSEABLE_EXT.has(filePath.slice(filePath.lastIndexOf(".")).toLowerCase());
}

/** 提取 CallExpression 的 callee 名字(只取可读名)。 */
function calleeName(node: t.CallExpression["callee"]): string | null {
  if (t.isIdentifier(node)) return node.name;
  if (t.isMemberExpression(node)) {
    // a.b.c → 取 property 链尾,够用
    const prop = node.property;
    if (t.isIdentifier(prop)) return prop.name;
  }
  return null;
}

/** 判断函数节点是否含 JSX(递归,浅层)。 */
function hasJsxInBody(body: t.BlockStatement | t.Expression): boolean {
  let found = false;
  const visit = (node: t.Node | null | undefined): void => {
    if (!node || found) return;
    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      found = true;
      return;
    }
    // 不深入嵌套函数(JSX 在内层函数不算本函数的)
    if (t.isFunction(node) || t.isClassMethod(node) || t.isObjectMethod(node)) return;
    for (const key of Object.keys(node)) {
      const val = (node as Record<string, unknown>)[key];
      if (Array.isArray(val)) val.forEach((v) => visit(v as t.Node));
      else if (val && typeof val === "object" && "type" in val) visit(val as t.Node);
    }
  };
  visit(body);
  return found;
}

/** 为一个函数节点收集函数体内的调用名。 */
function collectCalls(fnBody: t.BlockStatement | t.Expression): string[] {
  const calls = new Set<string>();
  const visit = (node: t.Node | null | undefined): void => {
    if (!node) return;
    if (t.isCallExpression(node)) {
      const name = calleeName(node.callee);
      if (name) calls.add(name);
    }
    // 不深入嵌套函数(它们的调用不算本函数的)
    if (t.isFunction(node) || t.isClassMethod(node) || t.isObjectMethod(node)) {
      if (node !== fnBody) return;
    }
    for (const key of Object.keys(node)) {
      const val = (node as Record<string, unknown>)[key];
      if (Array.isArray(val)) val.forEach((v) => visit(v as t.Node));
      else if (val && typeof val === "object" && "type" in val) visit(val as t.Node);
    }
  };
  visit(fnBody);
  return [...calls];
}

/** 解析单个文件,提取函数骨架 + import。 */
export function parseFile(file: string, source: string): FileSkeleton {
  const functions: FunctionSkeleton[] = [];
  const imports: string[] = [];
  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    });
  } catch {
    // 解析失败(语法错误/非标准)→ 返回空骨架,不阻断整体
    return { file, functions, imports };
  }

  // 收集 import 来源
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) {
      imports.push(node.source.value);
    }
  }

  // 遍历所有函数声明/表达式/方法
  const recordFn = (
    name: string | null,
    fnBody: t.BlockStatement | t.Expression,
    loc: { start: { line: number }; end: { line: number } } | null,
    exported: boolean,
  ) => {
    if (!name || !loc) return;
    functions.push({
      fn: name,
      startLine: loc.start.line,
      endLine: loc.end.line,
      calls: collectCalls(fnBody),
      exported,
      hasJsx: hasJsxInBody(fnBody),
    });
  };

  for (const node of ast.program.body) {
    // export default function foo() {} / export default function() {}
    if (t.isExportDefaultDeclaration(node) && t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
      recordFn(node.declaration.id.name, node.declaration.body, node.declaration.loc, true);
      continue;
    }
    // export function foo() {} / export async function foo() {}
    if (t.isExportNamedDeclaration(node) && t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
      recordFn(node.declaration.id.name, node.declaration.body, node.declaration.loc, true);
      continue;
    }
    // export const foo = () => {} / export const foo = function() {}
    if (t.isExportNamedDeclaration(node) && t.isVariableDeclaration(node.declaration)) {
      for (const decl of node.declaration.declarations) {
        if (decl.id && t.isIdentifier(decl.id) && t.isFunction(decl.init)) {
          recordFn(decl.id.name, (decl.init as t.Function).body, decl.init.loc, true);
        }
      }
      continue;
    }
    // function foo() {} (非 export)
    if (t.isFunctionDeclaration(node) && node.id) {
      recordFn(node.id.name, node.body, node.loc, false);
      continue;
    }
    // const foo = () => {} (非 export)
    if (t.isVariableDeclaration(node)) {
      for (const decl of node.declarations) {
        if (decl.id && t.isIdentifier(decl.id) && t.isFunction(decl.init)) {
          recordFn(decl.id.name, (decl.init as t.Function).body, decl.init.loc, false);
        }
      }
      continue;
    }
  }

  // 类方法:export class Foo {} / class Foo {}
  for (const node of ast.program.body) {
    let cls: t.ClassDeclaration | null = null;
    if (t.isClassDeclaration(node)) cls = node;
    else if (t.isExportNamedDeclaration(node) && t.isClassDeclaration(node.declaration)) cls = node.declaration;
    else if (t.isExportDefaultDeclaration(node) && t.isClassDeclaration(node.declaration)) cls = node.declaration;
    if (cls && cls.id) {
      for (const member of cls.body.body) {
        if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
          recordFn(`${cls.id.name}.${member.key.name}`, member.body, member.loc, true);
        }
      }
    }
  }

  return { file, functions, imports };
}
