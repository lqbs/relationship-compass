import type { WeeklyList } from '../domain/judgment.ts';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = `请求失败(${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 保留默认错误信息
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function fetchWeeklyList(): Promise<WeeklyList> {
  return request<WeeklyList>('/api/list');
}
