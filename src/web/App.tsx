import { useCallback, useEffect, useState } from 'react';

import { ListPage } from './ListPage.tsx';
import { ContactsPage } from './ContactsPage.tsx';
import { ContactDetailPage } from './ContactDetailPage.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string) => setToast(message), []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <span className="logo-dot" />
          Relationship Compass
        </div>
        <nav className="tabs">
          <a className={route.name === 'list' ? 'tab tab-active' : 'tab'} href="#/">
            本周清单
          </a>
          <a className={route.name === 'list' ? 'tab' : 'tab tab-active'} href="#/contacts">
            联系人
          </a>
        </nav>
      </header>

      <main className="content">
        {route.name === 'list' && <ListPage onToast={showToast} />}
        {route.name === 'contacts' && <ContactsPage onToast={showToast} />}
        {route.name === 'contact' && <ContactDetailPage id={route.id} onToast={showToast} />}
      </main>

      {toast !== null && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
