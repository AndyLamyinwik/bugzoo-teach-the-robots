/** Keep deployment paths local; reject traversal, URL schemes, and encoded separators. */
export function resolveBasePath(value: string | undefined): string {
  if (value === undefined || value === '/') return '/';
  if (!/^\/(?:[A-Za-z0-9._-]+\/)+$/.test(value))
    throw new Error('BUGZOO_BASE_PATH must be / or a path such as /repository-name/.');
  if (value.split('/').some((segment) => segment === '.' || segment === '..'))
    throw new Error('BUGZOO_BASE_PATH cannot contain traversal segments.');
  return value;
}
