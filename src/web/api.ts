import type { ContactEvaluation, WeeklyList } from '../domain/judgment.ts';
import type { CadenceKey, Interaction } from '../domain/types.ts';

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
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function fetchWeeklyList(): Promise<WeeklyList> {
  return request<WeeklyList>('/api/list');
}

export function recordInteraction(contactId: string, input: { date?: string; note?: string } = {}): Promise<Interaction> {
  return request<Interaction>(`/api/contacts/${encodeURIComponent(contactId)}/interactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchContacts(): Promise<{ today: string; contacts: ContactEvaluation[] }> {
  return request<{ today: string; contacts: ContactEvaluation[] }>('/api/contacts');
}

export function fetchContact(
  id: string,
): Promise<{ today: string; evaluation: ContactEvaluation; interactions: Interaction[] }> {
  return request<{ today: string; evaluation: ContactEvaluation; interactions: Interaction[] }>(
    `/api/contacts/${encodeURIComponent(id)}`,
  );
}

export function createContact(input: { name: string; note?: string; cadenceKey?: CadenceKey }): Promise<ContactEvaluation> {
  return request<ContactEvaluation>('/api/contacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateContact(
  id: string,
  patch: { name?: string; note?: string; cadenceKey?: CadenceKey; deferredUntil?: string | null },
): Promise<ContactEvaluation> {
  return request<ContactEvaluation>(`/api/contacts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function deleteContact(id: string): Promise<void> {
  return request<void>(`/api/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function deleteInteraction(id: string): Promise<void> {
  return request<void>(`/api/interactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
