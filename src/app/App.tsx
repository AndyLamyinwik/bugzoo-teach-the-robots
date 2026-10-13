import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { HomePage } from '../features/home/HomePage';
import { GlobalNavigation } from '../components/GlobalNavigation';
import { I18nProvider, useI18n } from '../i18n';
import { resolveLessonRoute } from './routes';
import type { AppRoute } from './routes';

const FractionFoxGame = lazy(() =>
  import('../features/fractionFox/FractionFoxGame').then((module) => ({
    default: module.FractionFoxGame,
  })),
);
const DiscountPandaGame = lazy(() =>
  import('../features/discountPanda/DiscountPandaGame').then((module) => ({
    default: module.DiscountPandaGame,
  })),
);
const MinusMoleGame = lazy(() =>
  import('../features/minusMole/MinusMoleGame').then((module) => ({
    default: module.MinusMoleGame,
  })),
);
const ChanceCrowGame = lazy(() =>
  import('../features/chanceCrow/ChanceCrowGame').then((module) => ({
    default: module.ChanceCrowGame,
  })),
);
const ProgressDashboard = lazy(() =>
  import('../features/progress/ProgressDashboard').then((module) => ({
    default: module.ProgressDashboard,
  })),
);
const LearningPassport = lazy(() =>
  import('../features/progress/LearningPassport').then((module) => ({
    default: module.LearningPassport,
  })),
);

function RouteLoading() {
  const { t } = useI18n();
  return (
    <p className="page-width bz-route-notice" role="status">
      {t('正在載入頁面…')}
    </p>
  );
}

function RouteFailure() {
  const { t } = useI18n();
  return (
    <main className="page-width bz-route-notice" tabIndex={-1}>
      <p role="alert">{t('這個頁面未能載入，請重新載入後再試。')}</p>
      <button
        type="button"
        className="home-lesson-link"
        onClick={() => window.location.reload()}
      >
        {t('重新載入頁面')}
      </button>
    </main>
  );
}

class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <RouteFailure /> : this.props.children;
  }
}

function RouteReady({
  route,
  focusPage,
  children,
}: {
  route: AppRoute;
  focusPage: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    // Lessons already focus their active step. Static pages need a destination
    // after navigation, including when a lazy page finishes loading later.
    if (focusPage && ['home', 'progress', 'passport'].includes(route))
      document.querySelector<HTMLElement>('main')?.focus();
  }, [route, focusPage]);
  return children;
}

function currentRoute() {
  return resolveLessonRoute(window.location.hash);
}

function AppContent() {
  const [focusPage, setFocusPage] = useState(false);
  const subscribeToNavigation = useCallback((onChange: () => void) => {
    const navigate = () => {
      setFocusPage(true);
      onChange();
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const route = useSyncExternalStore<AppRoute>(
    subscribeToNavigation,
    currentRoute,
    () => 'home',
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  let page: ReactNode;
  if (route === 'fractionfox') page = <FractionFoxGame />;
  else if (route === 'discountpanda') page = <DiscountPandaGame />;
  else if (route === 'minusmole') page = <MinusMoleGame />;
  else if (route === 'chancecrow') page = <ChanceCrowGame />;
  else if (route === 'progress') page = <ProgressDashboard />;
  else if (route === 'passport') page = <LearningPassport />;
  else page = <HomePage />;
  return (
    <>
      <GlobalNavigation route={route} />
      <RouteBoundary key={route}>
        <Suspense fallback={<RouteLoading />}>
          <RouteReady route={route} focusPage={focusPage}>
            {page}
          </RouteReady>
        </Suspense>
      </RouteBoundary>
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
