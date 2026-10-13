import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { initialProgressSummaries, progressStore } from './store';
import type { LessonId, LessonStateMap, LessonSummary, SaveStatus } from './types';

export function useLessonProgress<Id extends LessonId>(
  id: Id,
  createSession: () => LessonStateMap[Id],
): readonly [LessonStateMap[Id], Dispatch<SetStateAction<LessonStateMap[Id]>>] {
  const initial = useMemo(createSession, [createSession]);
  const getSnapshot = useCallback(() => progressStore.getSnapshot(id).state, [id]);
  const getServerSnapshot = useCallback(() => initial, [initial]);
  const state = useSyncExternalStore(
    progressStore.subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<Dispatch<SetStateAction<LessonStateMap[Id]>>>(
    (next) => {
      const current = progressStore.getSnapshot(id).state;
      progressStore.save(id, typeof next === 'function' ? next(current) : next);
    },
    [id],
  );
  return [state, setState];
}
export function useLessonProgressStatus(id: LessonId): SaveStatus {
  const getSnapshot = useCallback(() => progressStore.getSnapshot(id).saveStatus, [id]);
  return useSyncExternalStore(progressStore.subscribe, getSnapshot, () => 'empty');
}
export function useProgressStore(): readonly LessonSummary[] {
  return useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSummaries,
    () => initialProgressSummaries,
  );
}
