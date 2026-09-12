import { useCallback, useEffect, useState } from 'react';

import type { WeeklyList } from '../domain/judgment.ts';
import { fetchWeeklyList, recordInteraction } from './api.ts';
import { ListPage } from './ListPage.tsx';

export function App() {
  const [list, setList] = useState<WeeklyList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setList(await fetchWeeklyList());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRecord = useCallback(
    async (contactId: string, note: string) => {
      await recordInteraction(contactId, { note });
      setToast('已记录 · 清单已更新');
      await reload();
    },
    [reload],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <span className="logo-dot" />
          Relationship Compass
        </div>
        {list && <span className="topbar-date">{list.today}</span>}
      </header>

      <main className="content">
        {loading && !list && <p className="hint">正在加载…</p>}
        {error && (
          <div className="error-banner">
            {error}
            <button type="button" className="link-button" onClick={() => void reload()}>
              重试
            </button>
          </div>
        )}
        {list && <ListPage list={list} onRecord={handleRecord} />}
      </main>

      {toast !== null && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
