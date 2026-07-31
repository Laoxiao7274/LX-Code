import Editor from "@monaco-editor/react";
import { X } from "lucide-react";
import { useFileStore } from "./file-store";
import { cn } from "@/lib/utils";

/**
 * 代码编辑器:多 tab + Monaco。
 * 当前 demo 只读;后续接 agent 改动时展示 diff/编辑。
 */
export function CodeEditor() {
  const openFiles = useFileStore((s) => s.openFiles);
  const activePath = useFileStore((s) => s.activePath);
  const setActive = useFileStore((s) => s.setActive);
  const active = openFiles.find((f) => f.path === activePath);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 文件 tab 栏 */}
      <div className="flex h-9 items-center overflow-x-auto border-b border-border/60 bg-muted/20">
        {openFiles.map((f) => {
          const active = f.path === activePath;
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => setActive(f.path)}
              className={cn(
                "group flex h-full shrink-0 items-center gap-1.5 border-r border-border/40 px-3 text-[12px] transition-colors",
                active
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span className="font-mono">{f.path.split("/").pop()}</span>
              <X className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
          );
        })}
      </div>

      {/* Monaco 编辑器 */}
      <div className="flex-1 overflow-hidden">
        {active ? (
          <Editor
            path={active.path}
            language={active.language}
            value={active.content}
            theme="vs-dark"
            options={{
              readOnly: true,
              fontSize: 13,
              fontFamily: "JetBrains Mono, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "all",
              padding: { top: 12, bottom: 12 },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            选择左侧文件查看
          </div>
        )}
      </div>
    </div>
  );
}
