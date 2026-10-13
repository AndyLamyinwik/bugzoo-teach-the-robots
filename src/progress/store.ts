import { lessonCodecs } from './codec';
import { lessonIds } from './types';
import type {
  LessonId,
  LessonSnapshot,
  LessonStateMap,
  LessonSummary,
  ProgressStorage,
  SaveStatus,
} from './types';

export const progressKeyPrefix = 'bugzoo.progress.';
export function lessonStorageKey(id: LessonId): string {
  return `${progressKeyPrefix}${id}`;
}
type SnapshotMap = { [Id in LessonId]: LessonSnapshot<Id> };
type StorageSource = ProgressStorage | (() => ProgressStorage | undefined);
function browserStorage(): ProgressStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
function initialSnapshot<Id extends LessonId>(id: Id): LessonSnapshot<Id> {
  return { lessonId: id, state: lessonCodecs[id].createSession(), saveStatus: 'empty' };
}
function summarize<Id extends LessonId>(snapshot: LessonSnapshot<Id>): LessonSummary {
  const { lessonId, state, saveStatus } = snapshot;
  return {
    lessonId,
    stage: state.stage,
    status:
      state.stage === 'observe'
        ? 'not-started'
        : lessonCodecs[lessonId].isComplete(state)
          ? 'complete'
          : 'in-progress',
    experimentCount: state.experiments.length,
    effectiveExamples: state.evidence.filter(
      (record) => record.eliminatedRuleIds.length > 0,
    ).length,
    eliminatedRuleIds: [
      ...new Set(state.evidence.flatMap((record) => [...record.eliminatedRuleIds])),
    ],
    verificationPassed: state.verificationAnswers.length,
    verificationTotal: 3,
    saveStatus,
  };
}

/** Stable SSR snapshot: all four genuine initial domain sessions, without storage access. */
export const initialProgressSummaries: readonly LessonSummary[] = lessonIds.map((id) =>
  summarize(initialSnapshot(id)),
);

/** Each lesson has a separate key and an independent in-memory fallback. */
export function createProgressStore(source: StorageSource = browserStorage) {
  const snapshots: SnapshotMap = {
    fractionfox: initialSnapshot('fractionfox'),
    discountpanda: initialSnapshot('discountpanda'),
    minusmole: initialSnapshot('minusmole'),
    chancecrow: initialSnapshot('chancecrow'),
  };
  const loaded = new Set<LessonId>();
  const rejectedRecords = new Set<LessonId>();
  const listeners = new Set<() => void>();
  let summaries: readonly LessonSummary[] = lessonIds.map((id) =>
    summarize(snapshots[id]),
  );
  function storage(): ProgressStorage | undefined {
    return typeof source === 'function' ? source() : source;
  }
  function rebuildSummaries(): void {
    summaries = lessonIds.map((id) => summarize(snapshots[id]));
  }
  function publish(): void {
    rebuildSummaries();
    for (const listener of listeners) listener();
  }
  function update<Id extends LessonId>(
    id: Id,
    state: LessonStateMap[Id],
    saveStatus: SaveStatus,
  ): void {
    // The mapped property and its state are selected by the same Id.
    const snapshot = { lessonId: id, state, saveStatus } as SnapshotMap[Id];
    snapshots[id] = snapshot;
  }
  function read<Id extends LessonId>(id: Id): void {
    loaded.add(id);
    try {
      const target = storage();
      if (!target) {
        update(id, snapshots[id].state, 'memory-only');
        return;
      }
      const text = target.getItem(lessonStorageKey(id));
      if (text === null) {
        rejectedRecords.delete(id);
        update(id, lessonCodecs[id].createSession(), 'empty');
        return;
      }
      const result = lessonCodecs[id].decode(text);
      if (result.ok) rejectedRecords.delete(id);
      else rejectedRecords.add(id);
      update(
        id,
        result.ok ? result.state : lessonCodecs[id].createSession(),
        result.ok ? 'saved' : result.reason,
      );
    } catch {
      update(id, snapshots[id].state, 'memory-only');
    }
  }
  function getSnapshot<Id extends LessonId>(id: Id): LessonSnapshot<Id> {
    if (!loaded.has(id)) {
      read(id);
      rebuildSummaries();
    }
    return snapshots[id];
  }
  function getSummaries(): readonly LessonSummary[] {
    for (const id of lessonIds) if (!loaded.has(id)) read(id);
    // Rebuild only after initial reads, preserving stable snapshots for React.
    if (
      summaries.some(
        (summary) =>
          summary.saveStatus !== snapshots[summary.lessonId].saveStatus ||
          summary.stage !== snapshots[summary.lessonId].state.stage,
      )
    )
      rebuildSummaries();
    return summaries;
  }
  function save<Id extends LessonId>(id: Id, state: LessonStateMap[Id]): void {
    getSnapshot(id);
    if (state === snapshots[id].state) return;
    if (state.stage === 'complete' && !lessonCodecs[id].isComplete(state)) {
      update(id, snapshots[id].state, 'memory-only');
      publish();
      return;
    }
    let text: string;
    try {
      text = lessonCodecs[id].encode(state);
      const validated = lessonCodecs[id].decode(text);
      if (!validated.ok) {
        // Internal callers pass domain-command results. A bounded storage history
        // must never stop a valid live session from advancing.
        update(id, state, 'memory-only');
        publish();
        return;
      }
    } catch {
      update(id, state, 'memory-only');
      publish();
      return;
    }
    if (rejectedRecords.has(id)) {
      // A fresh lesson may continue, but only an explicit reset can discard the
      // rejected original. Later actions must not silently act as a migration.
      update(id, state, 'memory-only');
      publish();
      return;
    }
    let saveStatus: SaveStatus = 'saved';
    try {
      const target = storage();
      if (!target) saveStatus = 'memory-only';
      else target.setItem(lessonStorageKey(id), text);
    } catch {
      saveStatus = 'memory-only';
    }
    update(id, state, saveStatus);
    publish();
  }
  function resetLesson(id: LessonId): void {
    loaded.add(id);
    rejectedRecords.delete(id);
    let saveStatus: SaveStatus = 'empty';
    try {
      const target = storage();
      if (!target) saveStatus = 'memory-only';
      else target.removeItem(lessonStorageKey(id));
    } catch {
      saveStatus = 'memory-only';
    }
    update(id, lessonCodecs[id].createSession(), saveStatus);
    publish();
  }
  function resetAll(): void {
    // Known progress keys only: no localStorage.clear(), language preference is separate.
    for (const id of lessonIds) resetLesson(id);
  }
  function refresh(id?: LessonId): void {
    for (const lesson of id === undefined ? lessonIds : [id]) read(lesson);
    publish();
  }
  function handleStorageEvent(event: StorageEvent): void {
    if (event.storageArea !== null && event.storageArea !== undefined) {
      try {
        if (event.storageArea !== storage()) return;
      } catch {
        return;
      }
    }
    if (event.key === null) refresh();
    else {
      const id = lessonIds.find((lesson) => lessonStorageKey(lesson) === event.key);
      if (id) refresh(id);
    }
  }
  function subscribe(listener: () => void): () => void {
    if (
      listeners.size === 0 &&
      source === browserStorage &&
      typeof window !== 'undefined'
    )
      window.addEventListener('storage', handleStorageEvent);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (
        listeners.size === 0 &&
        source === browserStorage &&
        typeof window !== 'undefined'
      )
        window.removeEventListener('storage', handleStorageEvent);
    };
  }
  return { getSnapshot, getSummaries, save, resetLesson, resetAll, refresh, subscribe };
}

export const progressStore = createProgressStore();
