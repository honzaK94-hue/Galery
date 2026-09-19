import type { SQLiteDatabase } from "expo-sqlite";
import { databaseTask } from "../queue";

export type ThemePreference = "system" | "light" | "dark";

export class SettingsStore {
  private db: SQLiteDatabase | null = null;

  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }

  async getTheme(): Promise<ThemePreference> {
    const theme = await this.getSetting("theme");
    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme;
    }
    return "system";
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    await this.setSetting("theme", theme);
  }

  async getSetting(key: string): Promise<string | null> {
    return databaseTask(this.db, async (db) => {
      const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = ?`,
        [key],
      );
      return row?.value ?? null;
    });
  }

  async setSetting(key: string, value: string): Promise<void> {
    await databaseTask(this.db, (db) =>
      db.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      ),
    );
  }
}

export const settingsStore = new SettingsStore();
