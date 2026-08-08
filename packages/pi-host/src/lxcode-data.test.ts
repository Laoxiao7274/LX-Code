import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MIGRATION_ID } from "./migration-backup.js";
import {
  hostDataDir,
  migrateLegacyHostData,
  migratePideckDirToHost,
  migrationBackupRoot,
  modelBackupDir,
  providerJournalRoot,
  sessionArchiveDir,
} from "./lxcode-data.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createFixture(): { agentDir: string; cwd: string; safePath: string } {
  const root = mkdtempSync(join(tmpdir(), "lxcode-data-"));
  roots.push(root);
  const agentDir = join(root, "agent");
  const cwd = resolve(root, "workspace");
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  return { agentDir, cwd, safePath };
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

describe("host data paths", () => {
  it("keeps every host-owned storage family under one agent namespace", () => {
    const { agentDir, cwd, safePath } = createFixture();

    expect(hostDataDir(agentDir)).toBe(join(agentDir, "host"));
    expect(migrationBackupRoot(agentDir, MIGRATION_ID)).toBe(
      join(agentDir, "host", "migration-backups", MIGRATION_ID),
    );
    expect(providerJournalRoot(agentDir)).toBe(
      join(agentDir, "host", "provider-journal"),
    );
    expect(modelBackupDir(agentDir)).toBe(join(agentDir, "host", "model-backups"));
    expect(sessionArchiveDir(agentDir, cwd)).toBe(
      join(agentDir, "host", "session-archive", safePath),
    );
  });
});

describe("migratePideckDirToHost", () => {
  it("renames legacy agentDir/pideck to agentDir/host", async () => {
    const { agentDir } = createFixture();
    write(join(agentDir, "pideck", "attachments", "a.txt"), "attachment");
    write(join(agentDir, "pideck", "provider-journal", "j.json"), "journal");

    await migratePideckDirToHost(agentDir);

    expect(readFileSync(join(agentDir, "host", "attachments", "a.txt"), "utf8")).toBe(
      "attachment",
    );
    expect(readFileSync(join(agentDir, "host", "provider-journal", "j.json"), "utf8")).toBe(
      "journal",
    );
    expect(existsSync(join(agentDir, "pideck"))).toBe(false);
  });

  it("is a no-op when legacy pideck dir does not exist", async () => {
    const { agentDir } = createFixture();
    await expect(migratePideckDirToHost(agentDir)).resolves.toBeUndefined();
    expect(existsSync(join(agentDir, "pideck"))).toBe(false);
  });

  it("merges into existing host dir without overwriting", async () => {
    const { agentDir } = createFixture();
    write(join(agentDir, "pideck", "attachments", "old.txt"), "old");
    write(join(agentDir, "host", "attachments", "new.txt"), "new");

    await migratePideckDirToHost(agentDir);

    expect(readFileSync(join(agentDir, "host", "attachments", "old.txt"), "utf8")).toBe("old");
    expect(readFileSync(join(agentDir, "host", "attachments", "new.txt"), "utf8")).toBe("new");
    expect(existsSync(join(agentDir, "pideck"))).toBe(false);
  });
});

describe("migrateLegacyHostData", () => {
  it("adopts all four legacy storage families and is idempotent", async () => {
    const { agentDir, cwd, safePath } = createFixture();
    const legacyMigrationFile = join(
      agentDir,
      "backups",
      MIGRATION_ID,
      "snapshot",
      "manifest.json",
    );
    const legacyJournalFile = join(agentDir, "provider-journal", "journal-1", "journal.json");
    const legacyModelBackup = join(agentDir, "models-1001-00000001.bak");
    const unrelatedBackup = join(agentDir, "models-user-copy.bak");
    const legacyArchive = join(agentDir, "sessions", safePath, ".archive", "session.jsonl");
    write(legacyMigrationFile, "migration");
    write(legacyJournalFile, "journal");
    write(legacyModelBackup, "model backup");
    write(unrelatedBackup, "user backup");
    write(legacyArchive, "session");

    await migrateLegacyHostData(agentDir, MIGRATION_ID);
    await expect(migrateLegacyHostData(agentDir, MIGRATION_ID)).resolves.toBeUndefined();

    expect(
      readFileSync(join(migrationBackupRoot(agentDir, MIGRATION_ID), "snapshot", "manifest.json"), "utf8"),
    ).toBe("migration");
    expect(
      readFileSync(join(providerJournalRoot(agentDir), "journal-1", "journal.json"), "utf8"),
    ).toBe("journal");
    expect(readFileSync(join(modelBackupDir(agentDir), basename(legacyModelBackup)), "utf8")).toBe(
      "model backup",
    );
    expect(readFileSync(join(sessionArchiveDir(agentDir, cwd), "session.jsonl"), "utf8")).toBe(
      "session",
    );
    expect(existsSync(join(agentDir, "backups", MIGRATION_ID))).toBe(false);
    expect(existsSync(join(agentDir, "provider-journal"))).toBe(false);
    expect(existsSync(legacyModelBackup)).toBe(false);
    expect(existsSync(join(agentDir, "sessions", safePath, ".archive"))).toBe(false);
    expect(readFileSync(unrelatedBackup, "utf8")).toBe("user backup");
  });

  it("merges non-conflicting entries after a partially completed migration", async () => {
    const { agentDir } = createFixture();
    write(join(agentDir, "provider-journal", "legacy-entry", "journal.json"), "legacy");
    write(join(providerJournalRoot(agentDir), "new-entry", "journal.json"), "new");

    await migrateLegacyHostData(agentDir, MIGRATION_ID);

    expect(readFileSync(join(providerJournalRoot(agentDir), "legacy-entry", "journal.json"), "utf8"))
      .toBe("legacy");
    expect(readFileSync(join(providerJournalRoot(agentDir), "new-entry", "journal.json"), "utf8"))
      .toBe("new");
    expect(existsSync(join(agentDir, "provider-journal"))).toBe(false);
  });

  it("rejects conflicting files without overwriting either copy", async () => {
    const { agentDir } = createFixture();
    const legacy = join(agentDir, "provider-journal", "same-entry", "journal.json");
    const target = join(providerJournalRoot(agentDir), "same-entry", "journal.json");
    write(legacy, "legacy");
    write(target, "target");

    await expect(migrateLegacyHostData(agentDir, MIGRATION_ID)).rejects.toThrow(
      /conflicting host data/i,
    );

    expect(readFileSync(legacy, "utf8")).toBe("legacy");
    expect(readFileSync(target, "utf8")).toBe("target");
  });
});
