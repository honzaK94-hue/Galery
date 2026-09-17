import type { SQLiteDatabase } from 'expo-sqlite';

export type ThemePreference = 'system' | 'light' | 'dark';

class SettingsStore {
  private db: SQLiteDatabase | null = null;

  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }

  async getTheme(): Promise<ThemePreference> {
    if (!this.db) return 'system';
    const row = await this.db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'theme'`,
    );
    if (row?.value === 'light' || row?.value === 'dark' || row?.value === 'system') {
      return row.value;
    }
    return 'system';
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES ('theme', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [theme],
    );
  }

  async getSetting(key: string): Promise<string | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = ?`,
      [key],
    );
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}

export const settingsStore = new SettingsStore();
