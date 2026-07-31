import { create } from "zustand";

/** 文件树节点。 */
export interface FileNode {
  id: string;
  name: string;
  /** 目录才有 children。 */
  children?: FileNode[];
}

/** 当前打开的文件。 */
export interface OpenFile {
  path: string;
  content: string;
  language: string;
  /** 是否有未保存改动(demo)。 */
  dirty?: boolean;
}

interface FileState {
  tree: FileNode[];
  openFiles: OpenFile[];
  activePath: string | null;
  /** 选中文件树节点:目录切换展开,文件则打开。 */
  openFile: (path: string) => void;
  setActive: (path: string) => void;
  toggleDir: (id: string) => void;
  expanded: Record<string, boolean>;
}

const DEMO_TREE: FileNode[] = [
  {
    id: "src",
    name: "src",
    children: [
      {
        id: "src/utils",
        name: "utils",
        children: [{ id: "src/utils/filter.ts", name: "filter.ts" }],
      },
      {
        id: "src/pages",
        name: "pages",
        children: [
          { id: "src/pages/app.tsx", name: "app.tsx" },
          { id: "src/pages/chat.tsx", name: "chat.tsx" },
        ],
      },
      { id: "src/main.tsx", name: "main.tsx" },
    ],
  },
  {
    id: "tests",
    name: "tests",
    children: [{ id: "tests/filter.test.ts", name: "filter.test.ts" }],
  },
  { id: "package.json", name: "package.json" },
  { id: "README.md", name: "README.md" },
];

const DEMO_FILES: Record<string, OpenFile> = {
  "src/utils/filter.ts": {
    path: "src/utils/filter.ts",
    language: "typescript",
    content: `export function filter<T>(arr: T[], fn: (x: T) => boolean): T[] {
  let result: T[] = [];
  for (const x of arr) {
    if (fn(x)) result = [...result, x];
  }
  return result;
}
`,
  },
  "src/pages/app.tsx": {
    path: "src/pages/app.tsx",
    language: "typescript",
    content: `import { filter } from "./utils/filter";

export function App() {
  const nums = filter([1, 2, 3], (n) => n > 1);
  return <div>{nums.join(", ")}</div>;
}
`,
  },
};

export const useFileStore = create<FileState>((set, get) => ({
  tree: DEMO_TREE,
  openFiles: [DEMO_FILES["src/utils/filter.ts"]],
  activePath: "src/utils/filter.ts",
  expanded: { src: true, "src/utils": true },

  openFile: (path) => {
    const file = DEMO_FILES[path];
    if (!file) return;
    const exists = get().openFiles.some((f) => f.path === path);
    set({
      activePath: path,
      openFiles: exists
        ? get().openFiles
        : [...get().openFiles, file],
    });
  },

  setActive: (path) => set({ activePath: path }),

  toggleDir: (id) =>
    set({ expanded: { ...get().expanded, [id]: !get().expanded[id] } }),
}));
