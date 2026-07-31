import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { useFileStore, type FileNode } from "./file-store";
import { cn } from "@/lib/utils";

/** 单个节点递归渲染。 */
function Node({ node, depth }: { node: FileNode; depth: number }) {
  const expanded = useFileStore((s) => s.expanded[node.id] ?? false);
  const toggleDir = useFileStore((s) => s.toggleDir);
  const openFile = useFileStore((s) => s.openFile);
  const activePath = useFileStore((s) => s.activePath);

  const isDir = !!node.children;
  const isActive = node.id === activePath;

  return (
    <div>
      <button
        type="button"
        onClick={() => (isDir ? toggleDir(node.id) : openFile(node.id))}
        className={cn(
          "flex w-full items-center gap-1 rounded py-1 pr-2 text-left text-[12px] transition-colors",
          isActive
            ? "bg-accent/10 text-accent"
            : "text-foreground/80 hover:bg-muted/60",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        {isDir ? (
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-90")}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {isDir ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-mono">{node.name}</span>
      </button>
      {isDir && expanded ? (
        <div>
          {node.children?.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 文件树侧栏。 */
export function FileTree() {
  const tree = useFileStore((s) => s.tree);
  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        文件
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {tree.map((n) => (
          <Node key={n.id} node={n} depth={0} />
        ))}
      </div>
    </div>
  );
}
