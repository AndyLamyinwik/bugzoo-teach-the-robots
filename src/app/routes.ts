/** Only implemented lessons get a route; fragments within a lesson keep its session. */
export type AppRoute =
  | 'home'
  | 'fractionfox'
  | 'discountpanda'
  | 'minusmole'
  | 'chancecrow'
  | 'progress'
  | 'passport';

export const lessonLinks = {
  fractionfox: '#fractionfox',
  discountpanda: '#discountpanda',
  minusmole: '#minusmole',
  chancecrow: '#chancecrow',
} as const;

export function resolveLessonRoute(hash: string): AppRoute {
  if (hash === '#progress' || hash === '#progress-content') return 'progress';
  if (hash === '#passport' || hash === '#passport-content') return 'passport';
  if (hash === lessonLinks.fractionfox || hash === '#fractionfox-content')
    return 'fractionfox';
  if (hash === lessonLinks.discountpanda || hash === '#discountpanda-content')
    return 'discountpanda';
  if (hash === lessonLinks.minusmole || hash === '#minusmole-content') return 'minusmole';
  if (hash === lessonLinks.chancecrow || hash === '#chancecrow-content')
    return 'chancecrow';
  return 'home';
}
