import React, { useState, useEffect, useCallback } from 'react';
import App from './App';
import { AniTalaLanding } from './landing/AniTalaLanding';
import type { LandingLanguage } from './landing/types';
import { toStoreLanguage, fromStoreLanguage } from './landing/i18n';
import { useAppStore } from './store/useAppStore';

function getIsAppRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  return hash === '#/app' || hash.startsWith('#/app');
}

export const AniTalaRoot: React.FC = () => {
  const [isAppRoute, setIsAppRoute] = useState<boolean>(getIsAppRoute);
  const [language, setLanguage] = useState<LandingLanguage>(() =>
    fromStoreLanguage(useAppStore.getState().language)
  );

  // Sync route changes
  useEffect(() => {
    const handleRoute = () => {
      const isApp = getIsAppRoute();
      setIsAppRoute(isApp);
      if (isApp) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    };

    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);

    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  // Sync store language changes
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state) => {
      const derived = fromStoreLanguage(state.language);
      setLanguage((prev) => (prev !== derived ? derived : prev));
    });
    return unsubscribe;
  }, []);

  const handleLanguageChange = useCallback((newLang: LandingLanguage) => {
    setLanguage(newLang);
    useAppStore.getState().setLanguage(toStoreLanguage(newLang));
  }, []);

  if (isAppRoute) {
    return <App />;
  }

  return (
    <AniTalaLanding
      language={language}
      onLanguageChange={handleLanguageChange}
    />
  );
};

export default AniTalaRoot;
