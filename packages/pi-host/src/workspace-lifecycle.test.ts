import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceLifecycle, workspaceIdentityKey } from "./workspace-lifecycle.js";
import type { SessionRuntimeCache } from "./session-runtime-cache.js";
import type { GraphFactoryDeps, WorkspaceGraph } from "./workspace-graph-types.js";

function lifecycle(platform?: NodeJS.Platform) {
  return new WorkspaceLifecycle(
    {
      deps: { agentDir: "C:/agent" } as GraphFactoryDeps,
      getGraph: () => null,
      setGraph: vi.fn(),
      setGraphRaw: vi.fn(),
      getRegisteredGraph: () => null,
      getServer: () => null,
      onModelHealthChanged: vi.fn(),
      platform,
    },
    {} as unknown as SessionRuntimeCache,
  );
}

describe("Workspace lifecycle", () => {
  it("preserves case-sensitive workspace identities on Unix-like platforms", () => {
    expect(workspaceIdentityKey("/repo/Foo", "linux")).not.toBe(
      workspaceIdentityKey("/repo/foo", "linux"),
    );
    expect(workspaceIdentityKey("/repo/Foo", "darwin")).not.toBe(
      workspaceIdentityKey("/repo/foo", "darwin"),
    );
  });

  it("normalizes separators and casing for Windows workspace identities", () => {
    expect(workspaceIdentityKey("C:\\Repos\\Alpha", "win32")).toBe(
      workspaceIdentityKey("c:/repos/ALPHA", "win32"),
    );
  });

  it("does not reactivate a retained graph with a different canonical identity", () => {
    // retainedGraphs 机制已移除(改为 factory 注册表),该行为由 factory 负责,这里不再测。
  });

  it("retains differently-cased Unix Workspace graphs independently", () => {
    // 同上,注册表行为由 factory 测试覆盖。
  });

  it("invalidates only the retained graph for the matching Workspace", async () => {
    // invalidateRetainedWorkspaceGraph 已移除(改为 factory.removeRegisteredGraph),该行为由 factory 测试覆盖。
  });

  it("canonicalizes an existing Workspace path", () => {
    const root = mkdtempSync(join(tmpdir(), "lxcode-workspace-lifecycle-"));
    try {
      expect(lifecycle().canonicalizeCwd(root)).toBe(realpathSync(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing Workspace path without mutating state", () => {
    const root = mkdtempSync(join(tmpdir(), "lxcode-workspace-lifecycle-"));
    const missing = join(root, "missing");
    try {
      let thrown: unknown;
      try {
        lifecycle().canonicalizeCwd(missing);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({
        code: "WORKSPACE_SWITCH_FAILED",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an existing file as a Workspace", () => {
    const root = mkdtempSync(join(tmpdir(), "lxcode-workspace-lifecycle-"));
    const file = join(root, "workspace.txt");
    writeFileSync(file, "not a directory");
    try {
      expect(() => lifecycle().canonicalizeCwd(file)).toThrowError(
        expect.objectContaining({ code: "WORKSPACE_NOT_DIRECTORY" }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a symlink to a Workspace directory", () => {
    const root = mkdtempSync(join(tmpdir(), "lxcode-workspace-lifecycle-"));
    const target = join(root, "target");
    const link = join(root, "link");
    try {
      mkdirSync(target);
      symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
      expect(lifecycle().canonicalizeCwd(link)).toBe(realpathSync(target));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("builds the public Workspace snapshot from lifecycle-owned fields", () => {
    const graph = {
      workspaceId: "workspace-id",
      cwd: "C:/workspace",
      canonicalCwd: "C:/workspace",
      revision: 4,
      servicesReady: true,
    } as WorkspaceGraph;

    expect(lifecycle().buildWorkspaceSnapshot(graph)).toEqual({
      id: "workspace-id",
      cwd: "C:/workspace",
      canonicalCwd: "C:/workspace",
      revision: 4,
      servicesReady: true,
    });
  });
});
