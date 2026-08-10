# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
在仓库 C:/Users/xzy/Desktop/my/lx-code-next 做一次彻底的品牌标识清理:把所有 `pideck`/`PiDeck`/`PIDECK` 替换成 `lxcode`/`LXCode`/`LXCODE`。

## 背景
这是从 Skitre/PiDeck 二开的 LXCode 项目(Tauri + React + pi-host sidecar)。代码里残留大量 pideck 标识符(约 92 个文件),要全部清理。用户可见文案已清完(i18n 里没有 pideck),现在清代码内部标识符。

## 关键约束(必须先读懂再动手)
1. **pi-host 数据目录冲突**:pi-host 用 `pideck-data.ts` 的 `pideckDataDir()` 返回 `~/.lxcode/pideck/` 存数据(attachments/model-backups/provider-journal/session-archive/migration-backups)。但 Rust 侧 `apps/desktop/src-tauri/src/desktop_settings.rs` 的 `LXCODE_DATA_DIR_NAME="lxcode"` 已占用 `~/.lxcode/lxcode/`(存 DefaultProject 工作区数据)。**所以 pi-host 的数据子目录不能改成 `lxcode`,改成 `host`**(即 `~/.lxcode/host/`)。
2. **数据目录迁移**:`pideckDataDir` 改名后,要在 pi-host 启动早期加迁移逻辑——若旧 `~/.lxcode/pideck/` 存在且新 `~/.lxcode/host/` 不存在,把 pideck rename 成 host(同卷 rename,原子)。参考现有 `migrateLegacyPideckData` 的 moveLegacyTree 模式。在 main.ts 启动流程合适位置调用。
3. **模块重命名**:`packages/pi-host/src/pideck-data.ts` → `lxcode-data.ts`(注意:文件名可以叫 lxcode-data,因为它不是目录名不冲突;但里面导出的 pideckDataDir 函数返回的目录名要是 "host")。更新所有 import 它的文件。
4. **导出符号重命名**:`PIDECK_MODEL_BACKUP_PATTERN`→`LXCODE_MODEL_BACKUP_PATTERN`、`pideckDataDir`→`hostDataDir`(或类似清晰名)、`migrateLegacyPideckData`→`migrateLegacyHostData` 等,保持语义清晰。
5. **协议 key**:`pideck:` 这种 UI metadata key(extension-ui-bridge.ts 的 `plainRecord(options)?.pideck`、test-flow 的 `pideck:{...}`、App.tsx/clientName "pideck")→ 统一改成 `lxcode:`。host 读写 + 前端 + 测试要同步改,保持一致,否则扩展 UI 弹窗(select 的自由输入/optionDetails)会失效。
6. **Rust test 文件**:`apps/desktop/src-tauri/src/pi_host_tests.rs` 里的 `PiDeck` 路径示例字符串 → `LXCode`。

## 排除(不要改)
- node_modules、.git、.git-broken-backup、dist、target、build 目录
- `reference/` 目录(只读)
- `.map` 文件(构建产物,重新 build 会再生成)
- pnpm-lock.yaml 里的版本 hash 内容不要手动改
- `reference/pideck-skitre` 整个目录不动

## 流程
1. 先用 grep 全面盘点 pideck/PiDeck/PIDECK 出现位置(packages/pi-host/src、apps/desktop/src、apps/desktop/src-tauri/src、scripts),分类:协议key / 数据目录 / 模块名 / 普通标识符 / 字符串。
2. 逐文件精确替换(用 edit 工具,保持大小写对应:pideck→lxcode 或按上下文,PiDeck→LXCode,PIDECK→LXCODE)。注意:`pideckDataDir` 这类数据目录函数,目录名返回值改成 "host"(不是 lxcode,避免冲突);但函数名可改 hostDataDir。
3. 重命名 pideck-data.ts → lxcode-data.ts(git mv),更新所有 import。
4. 加数据目录迁移逻辑(pideck/ → host/),在 main.ts 启动早期调用。
5. **验证**(必须全过):
   - `cd packages/pi-host && pnpm run build`(tsc 编译过,无类型错误)
   - `cd packages/protocol && pnpm run build`
   - pi-host 和 protocol 的测试:`pnpm --filter @lxcode/pi-host test`、`pnpm --filter @lxcode/protocol test`(如果太久可只跑受影响的 test 文件)
   - 前端 typecheck:`cd apps/desktop && npx tsc -p tsconfig.json --noEmit`
6. 全部通过后 `git add -A && git commit`(不要 push,我来 push)。commit message 说明改动。

## 完成后报告
- 改了哪些文件(分类列出)
- 数据目录迁移逻辑怎么写的
- 验证结果(哪些测试跑了、通过情况)
- 有没有遗漏的 pideck 残留(grep 确认清干净了)
- 遇到的风险点/需要我注意的地方

注意:这是个细致活,宁可慢一点也要保证替换后代码能编译、测试能过、扩展 UI 功能不破坏。不要图快批量 sed 导致语法错误。每个文件改完确认没问题再下一个。

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Review gate: required by reviewer.

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```