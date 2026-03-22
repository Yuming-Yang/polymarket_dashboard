import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("insider wallet history backfill migration", () => {
  it("documents verification SQL and keeps unresolved ingests out of resolved_trades", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260322170000_insider_wallet_history_backfill.sql",
    );
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("p_is_win := null");
    expect(migration).toContain("-- Verification query 1:");
    expect(migration).toContain("-- Verification query 2:");
    expect(migration).toContain("count(*) filter (where is_win is not null)");
    expect(migration).toContain("count(*) filter (where is_win = true)");
  });
});
