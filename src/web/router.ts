import { useEffect, useState } from 'react';

export type Route = { name: 'list' } | { name: 'contacts' } | { name: 'contact'; id: string };

function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#/, '');
  const contactMatch = cleaned.match(/^\/contacts\/([^/]+)$/);
  if (contactMatch) {
    return { name: 'contact', id: decodeURIComponent(contactMatch[1] ?? '') };
  }
  if (cleaned === '/contacts') {
    return { name: 'contacts' };
  }
  return { name: 'list' };
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = (): void => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
