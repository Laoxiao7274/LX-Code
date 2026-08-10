`PIDECK_SPIKE_*` 只在 fixture 的 spike-extension.ts，没有 test 引用（是 spike 实验性 fixture）。保留（fixture 数据）。

清理完成。生成验收报告：

## 完成总结

彻底清理了 pideck/PiDeck 品牌标识，104 文件改动（+465/-459），提交 `edf32f3`。

**四类处理**：
1. **数据目录**：`pideck-data.ts`→`lxcode-data.ts`，目录 `agentDir/pideck/`→`agentDir/host/`（避开与 Rust `lxcode/` 冲突），新增 `migratePideckDirToHost` 启动迁移
2. **持久化 key 加 legacy 兼容**：models.json/localStorage/attachment 标签改 lxcode，旧 pideck key 读取 fallback，不丢用户设置
3. **环境变量**：`PIDECK_HOST_CACHE_DIR`/`PIDECK_CONFIG_DIR`/`PIDECK_STAGED_*` 等 → `LXCODE_*`，Rust+host+scripts 同步
4. **普通标识符**：注释/clientName/UA/DOM 属性/CSS 类等 → lxcode

**保留不改**（有兼容/契约原因）：SDK 协议 key `pideck:`（SDK 公开 API 类型）、MIGRATION_ID（历史标识）、fixture 数据（模拟旧版）。