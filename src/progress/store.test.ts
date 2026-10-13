import { describe, expect, it, vi } from 'vitest';
import * as fraction from '../domain/fractionFox/engine';
import * as discount from '../domain/discountPanda/engine';
import * as minus from '../domain/minusMole/engine';
import * as chance from '../domain/chanceCrow/engine';
import { lessonCodecs, maximumHistory } from './codec';
import { createProgressStore, lessonStorageKey } from './store';
import { lessonIds } from './types';
import type { LessonId, LessonStateMap, ProgressStorage } from './types';

class MemoryStorage implements ProgressStorage {
  readonly values = new Map<string, string>();
  readonly getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  readonly setItem = vi.fn((key: string, value: string) => {
    this.values.set(key, value);
  });
  readonly removeItem = vi.fn((key: string) => {
    this.values.delete(key);
  });
}
function progressedStates(): LessonStateMap {
  return {
    fractionfox: fraction.chooseHypothesis(
      fraction.beginHypothesis(fraction.createSession()).state,
      'add-both',
    ).state,
    discountpanda: discount.chooseHypothesis(
      discount.beginHypothesis(discount.createSession()).state,
      'add-discounts',
    ).state,
    minusmole: minus.chooseHypothesis(
      minus.beginHypothesis(minus.createSession()).state,
      'subtract-absolute',
    ).state,
    chancecrow: chance.chooseHypothesis(
      chance.beginHypothesis(chance.createSession()).state,
      'independent',
    ).state,
  };
}
function saveAll(
  target: ReturnType<typeof createProgressStore>,
  states = progressedStates(),
): void {
  for (const id of lessonIds) target.save(id, states[id]);
}
function fractionTeachingState() {
  const state = progressedStates().fractionfox;
  return fraction.beginTeaching(
    fraction.runExperiment(state, {
      left: { numerator: '1', denominator: '2' },
      right: { numerator: '1', denominator: '3' },
    }).state,
  ).state;
}
describe('independent lesson persistence and stable subscriptions', () => {
  it('does no writes during initialization and caches stable snapshots', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    expect(storage.getItem).toHaveBeenCalledTimes(0);
    const first = store.getSnapshot('fractionfox');
    expect(first).toBe(store.getSnapshot('fractionfox'));
    expect(store.getSummaries()).toBe(store.getSummaries());
    expect(storage.setItem).toHaveBeenCalledTimes(0);
    expect(storage.removeItem).toHaveBeenCalledTimes(0);
  });
  it('writes every applied change immediately and restores all four independent sessions', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const states = progressedStates();
    saveAll(store, states);
    expect(storage.setItem).toHaveBeenCalledTimes(4);
    expect(listener).toHaveBeenCalledTimes(4);
    const reloaded = createProgressStore(storage);
    for (const id of lessonIds)
      expect(reloaded.getSnapshot(id)).toEqual({
        lessonId: id,
        state: states[id],
        saveStatus: 'saved',
      });
    store.save('fractionfox', states.fractionfox);
    expect(storage.setItem).toHaveBeenCalledTimes(4);
    unsubscribe();
    store.resetLesson('fractionfox');
    expect(listener).toHaveBeenCalledTimes(4);
  });
  it('summarizes actual accepted counterexamples and verification rather than guesses', () => {
    const store = createProgressStore(new MemoryStorage());
    const teaching = fractionTeachingState();
    const nonDiscriminating = fraction.teachExample(teaching, {
      input: {
        left: { numerator: '0', denominator: '2' },
        right: { numerator: '0', denominator: '3' },
      },
      proposedAnswer: { numerator: '0', denominator: '1' },
    }).state;
    store.save('fractionfox', nonDiscriminating);
    expect(store.getSummaries()[0]).toMatchObject({
      stage: 'teach',
      status: 'in-progress',
      effectiveExamples: 0,
      eliminatedRuleIds: [],
      verificationPassed: 0,
      verificationTotal: 3,
    });
    const trained = fraction.teachExample(nonDiscriminating, {
      input: {
        left: { numerator: '1', denominator: '2' },
        right: { numerator: '1', denominator: '3' },
      },
      proposedAnswer: { numerator: '5', denominator: '6' },
    }).state;
    const beforeTeachingUpdate = store.getSummaries();
    store.save('fractionfox', trained);
    expect(store.getSummaries() === beforeTeachingUpdate).toBe(false);
    expect(store.getSummaries()).toBe(store.getSummaries());
    expect(store.getSummaries()[0]).toMatchObject({
      stage: 'teach',
      effectiveExamples: 1,
      eliminatedRuleIds: ['add-both', 'keep-first'],
    });
    let verify = fraction.beginVerification(trained).state;
    const first = verify.verification[0];
    if (!first) throw new Error('Missing verification');
    verify = fraction.answerVerification(verify, first.id, {
      numerator: first.correctAnswer.numerator.toString(),
      denominator: first.correctAnswer.denominator.toString(),
    }).state;
    store.save('fractionfox', verify);
    expect(store.getSummaries()[0]).toMatchObject({
      status: 'in-progress',
      effectiveExamples: 1,
      eliminatedRuleIds: ['add-both', 'keep-first'],
      verificationPassed: 1,
    });
    for (const question of verify.verification.slice(1))
      verify = fraction.answerVerification(verify, question.id, {
        numerator: question.correctAnswer.numerator.toString(),
        denominator: question.correctAnswer.denominator.toString(),
      }).state;
    store.save('fractionfox', verify);
    const restored = createProgressStore(storeStorage(store, 'fractionfox'));
    expect(restored.getSummaries()[0]).toMatchObject({
      status: 'complete',
      verificationPassed: 3,
    });
    expect(
      store
        .getSummaries()
        .slice(1)
        .every((item) => item.status === 'not-started'),
    ).toBe(true);
  });
  it.each(lessonIds)(
    'resets only %s and leaves other lessons, preferences and foreign data intact',
    (id) => {
      const storage = new MemoryStorage();
      const store = createProgressStore(storage);
      saveAll(store);
      storage.values.set('bugzoo.language', 'en');
      storage.values.set('other-app', 'important');
      const before = new Map(storage.values);
      store.resetLesson(id);
      expect(store.getSnapshot(id)).toMatchObject({
        state: { stage: 'observe' },
        saveStatus: 'empty',
      });
      expect(storage.values.has(lessonStorageKey(id))).toBe(false);
      for (const [key, value] of before)
        if (key !== lessonStorageKey(id)) expect(storage.values.get(key)).toBe(value);
    },
  );
  it('reset-all removes only the known progress keys, including corrupt/versioned records', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    saveAll(store);
    storage.values.set(lessonStorageKey('chancecrow'), '{bad');
    storage.values.set('bugzoo.language', 'en');
    storage.values.set('foreign', 'keep');
    store.resetAll();
    expect(storage.values).toEqual(
      new Map([
        ['bugzoo.language', 'en'],
        ['foreign', 'keep'],
      ]),
    );
    expect(store.getSummaries().every((item) => item.status === 'not-started')).toBe(
      true,
    );
  });
  it('retains corrupt data and scopes the recovery state to the affected lesson', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    saveAll(store);
    storage.values.set(lessonStorageKey('fractionfox'), '{bad');
    const restored = createProgressStore(storage);
    expect(restored.getSnapshot('fractionfox')).toMatchObject({
      state: { stage: 'observe' },
      saveStatus: 'corrupt',
    });
    expect(restored.getSnapshot('discountpanda')).toMatchObject({
      state: { stage: 'experiment' },
      saveStatus: 'saved',
    });
    expect(storage.values.get(lessonStorageKey('fractionfox'))).toBe('{bad');
    expect(storage.removeItem).toHaveBeenCalledTimes(0);
  });
  it('reports unsupported versions without clearing them or applying a fake old migration', () => {
    const storage = new MemoryStorage();
    const dto: unknown = JSON.parse(
      lessonCodecs.minusmole.encode(progressedStates().minusmole),
    );
    if (typeof dto !== 'object' || dto === null) throw new Error('Missing dto');
    storage.values.set(
      lessonStorageKey('minusmole'),
      JSON.stringify({ ...dto, lessonVersion: 2 }),
    );
    const store = createProgressStore(storage);
    expect(store.getSnapshot('minusmole')).toMatchObject({
      saveStatus: 'unsupported-version',
      state: { stage: 'observe' },
    });
    expect(store.getSnapshot('fractionfox').saveStatus).toBe('empty');
    expect(storage.values.has(lessonStorageKey('minusmole'))).toBe(true);
  });
  it.each(['corrupt', 'unsupported-version'] as const)(
    'preserves a %s record while a fresh lesson remains playable until explicit reset',
    (reason) => {
      const storage = new MemoryStorage();
      const originalStore = createProgressStore(storage);
      originalStore.save('discountpanda', progressedStates().discountpanda);
      const pandaRecord = storage.values.get(lessonStorageKey('discountpanda'));
      storage.values.set('bugzoo.locale.v1', 'zh-TW');
      storage.values.set('foreign', 'keep');
      let rejectedRecord = '{bad';
      if (reason === 'unsupported-version') {
        const dto: unknown = JSON.parse(
          lessonCodecs.fractionfox.encode(progressedStates().fractionfox),
        );
        if (dto === null || typeof dto !== 'object' || Array.isArray(dto))
          throw new Error('Expected a real saved lesson record');
        rejectedRecord = JSON.stringify({ ...dto, lessonVersion: 999 });
      }
      storage.values.set(lessonStorageKey('fractionfox'), rejectedRecord);
      const writesBefore = storage.setItem.mock.calls.length;
      const store = createProgressStore(storage);
      expect(store.getSnapshot('fractionfox')).toMatchObject({
        state: { stage: 'observe' },
        saveStatus: reason,
      });

      let state = fraction.beginHypothesis(store.getSnapshot('fractionfox').state).state;
      store.save('fractionfox', state);
      expect(storage.values.get(lessonStorageKey('fractionfox'))).toBe(rejectedRecord);
      state = fraction.chooseHypothesis(state, 'add-both').state;
      store.save('fractionfox', state);
      state = fraction.runExperiment(state, {
        left: { numerator: '1', denominator: '2' },
        right: { numerator: '1', denominator: '3' },
      }).state;
      state = fraction.beginTeaching(state).state;
      state = fraction.teachExample(state, {
        input: {
          left: { numerator: '1', denominator: '2' },
          right: { numerator: '1', denominator: '3' },
        },
        proposedAnswer: { numerator: '5', denominator: '6' },
      }).state;
      store.save('fractionfox', state);
      state = fraction.beginVerification(state).state;
      for (const question of state.verification) {
        state = fraction.answerVerification(state, question.id, {
          numerator: question.correctAnswer.numerator.toString(),
          denominator: question.correctAnswer.denominator.toString(),
        }).state;
        store.save('fractionfox', state);
      }
      expect(store.getSnapshot('fractionfox')).toMatchObject({
        state: { stage: 'complete' },
        saveStatus: 'memory-only',
      });
      expect(store.getSummaries()[0]).toMatchObject({
        status: 'complete',
        effectiveExamples: 1,
        verificationPassed: 3,
      });
      expect(storage.setItem).toHaveBeenCalledTimes(writesBefore);
      expect(storage.values.get(lessonStorageKey('fractionfox'))).toBe(rejectedRecord);
      expect(createProgressStore(storage).getSnapshot('fractionfox')).toMatchObject({
        state: { stage: 'observe' },
        saveStatus: reason,
      });
      expect(store.getSnapshot('discountpanda').saveStatus).toBe('saved');
      expect(storage.values.get(lessonStorageKey('discountpanda'))).toBe(pandaRecord);

      store.resetLesson('fractionfox');
      expect(storage.values.has(lessonStorageKey('fractionfox'))).toBe(false);
      const fresh = fraction.beginHypothesis(
        store.getSnapshot('fractionfox').state,
      ).state;
      store.save('fractionfox', fresh);
      expect(store.getSnapshot('fractionfox').saveStatus).toBe('saved');
      expect(createProgressStore(storage).getSnapshot('fractionfox').state).toEqual(
        fresh,
      );
      expect(storage.values.get(lessonStorageKey('discountpanda'))).toBe(pandaRecord);
      expect(storage.values.get('bugzoo.locale.v1')).toBe('zh-TW');
      expect(storage.values.get('foreign')).toBe('keep');
    },
  );
  it('refreshes updated external data and notifies dashboard/game subscribers', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    store.getSummaries();
    const previous = store.getSnapshot('discountpanda');
    const listener = vi.fn();
    store.subscribe(listener);
    storage.values.set(
      lessonStorageKey('fractionfox'),
      lessonCodecs.fractionfox.encode(progressedStates().fractionfox),
    );
    store.refresh('fractionfox');
    expect(store.getSnapshot('fractionfox').state.stage).toBe('experiment');
    expect(store.getSnapshot('discountpanda')).toBe(previous);
    expect(listener).toHaveBeenCalledOnce();
  });
  it('subscribes to browser storage events for known lesson keys and ignores language/foreign keys', () => {
    const storage = new MemoryStorage();
    let handler: ((event: StorageEvent) => void) | undefined;
    const addEventListener = vi.fn(
      (type: string, callback: (event: StorageEvent) => void) => {
        if (type === 'storage') handler = callback;
      },
    );
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', {
      localStorage: storage,
      addEventListener,
      removeEventListener,
    });
    try {
      const store = createProgressStore();
      store.getSummaries();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      expect(addEventListener).toHaveBeenCalledOnce();
      storage.values.set(
        lessonStorageKey('chancecrow'),
        lessonCodecs.chancecrow.encode(progressedStates().chancecrow),
      );
      // The browser event handler reads only key; the remaining native event fields
      // do not affect this injected event fixture.
      handler?.({ key: lessonStorageKey('chancecrow') } as StorageEvent);
      expect(store.getSnapshot('chancecrow').state.stage).toBe('experiment');
      expect(listener).toHaveBeenCalledOnce();
      handler?.({ key: 'bugzoo.language' } as StorageEvent);
      handler?.({ key: 'other-app' } as StorageEvent);
      expect(listener).toHaveBeenCalledOnce();
      // sessionStorage changes are a different browser storage area.
      handler?.({
        key: lessonStorageKey('chancecrow'),
        storageArea: new MemoryStorage(),
      } as unknown as StorageEvent);
      expect(listener).toHaveBeenCalledOnce();
      storage.values.delete(lessonStorageKey('chancecrow'));
      handler?.({ key: null } as StorageEvent);
      expect(store.getSnapshot('chancecrow').state.stage).toBe('observe');
      expect(listener).toHaveBeenCalledTimes(2);
      unsubscribe();
      expect(removeEventListener).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function storeStorage<Id extends LessonId>(
  store: ReturnType<typeof createProgressStore>,
  id: Id,
): ProgressStorage {
  const text = lessonCodecs[id].encode(store.getSnapshot(id).state);
  return {
    getItem: (key) => (key === lessonStorageKey(id) ? text : null),
    setItem: () => undefined,
    removeItem: () => undefined,
  };
}
describe('non-blocking memory fallback', () => {
  it('keeps learning through quota errors and recovers on a later successful save', () => {
    const storage = new MemoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const store = createProgressStore(storage);
    const state = progressedStates().fractionfox;
    store.save('fractionfox', state);
    expect(store.getSnapshot('fractionfox')).toMatchObject({
      state,
      saveStatus: 'memory-only',
    });
    expect(store.getSnapshot('minusmole').saveStatus).toBe('empty');
    storage.setItem.mockImplementation((key, value) => {
      storage.values.set(key, value);
    });
    const next = fraction.runExperiment(state, {
      left: { numerator: '1', denominator: '2' },
      right: { numerator: '1', denominator: '3' },
    }).state;
    store.save('fractionfox', next);
    expect(store.getSnapshot('fractionfox').saveStatus).toBe('saved');
    expect(createProgressStore(storage).getSnapshot('fractionfox').state).toEqual(next);
  });
  it('handles disabled reads and throwing localStorage access without crashing', () => {
    const storage = new MemoryStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const store = createProgressStore(storage);
    expect(store.getSnapshot('minusmole')).toMatchObject({
      saveStatus: 'memory-only',
      state: { stage: 'observe' },
    });
    store.save('minusmole', progressedStates().minusmole);
    expect(store.getSnapshot('minusmole').state.stage).toBe('experiment');
    const unavailable = createProgressStore(() => {
      throw new Error('SecurityError');
    });
    saveAll(unavailable);
    expect(
      unavailable
        .getSummaries()
        .every(
          (item) => item.saveStatus === 'memory-only' && item.status === 'in-progress',
        ),
    ).toBe(true);
  });
  it('resets in memory when removal fails and leaves other lessons playable', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    saveAll(store);
    storage.removeItem.mockImplementation((key) => {
      if (key === lessonStorageKey('fractionfox')) throw new Error('SecurityError');
      storage.values.delete(key);
    });
    store.resetAll();
    expect(store.getSnapshot('fractionfox')).toMatchObject({
      saveStatus: 'memory-only',
      state: { stage: 'observe' },
    });
    expect(store.getSummaries()[0]?.status).toBe('not-started');
    expect(
      store
        .getSummaries()
        .slice(1)
        .every((item) => item.saveStatus === 'empty'),
    ).toBe(true);
  });
  it('keeps prior valid in-memory state when a subsequent read fails', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    const state = progressedStates().chancecrow;
    store.save('chancecrow', state);
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    store.refresh('chancecrow');
    expect(store.getSnapshot('chancecrow')).toMatchObject({
      state,
      saveStatus: 'memory-only',
    });
  });
  it('works without browser storage and can reset the fallback session', () => {
    const store = createProgressStore(() => undefined);
    const state = progressedStates().minusmole;
    store.save('minusmole', state);
    expect(store.getSnapshot('minusmole')).toMatchObject({
      state,
      saveStatus: 'memory-only',
    });
    store.resetLesson('minusmole');
    expect(store.getSnapshot('minusmole')).toMatchObject({
      state: { stage: 'observe' },
      saveStatus: 'memory-only',
    });
  });
  it('continues a valid live session when history exceeds the persistence safety bound', () => {
    const storage = new MemoryStorage();
    const store = createProgressStore(storage);
    let state = progressedStates().minusmole;
    store.save('minusmole', state);
    const previousSaved = storage.values.get(lessonStorageKey('minusmole'));
    for (let index = 0; index <= maximumHistory; index += 1)
      state = minus.runExperiment(state, { a: '5', b: '-3' }).state;
    store.save('minusmole', state);
    expect(store.getSnapshot('minusmole')).toMatchObject({
      state,
      saveStatus: 'memory-only',
    });
    expect(store.getSnapshot('minusmole').state.experiments).toHaveLength(
      maximumHistory + 1,
    );
    expect(storage.values.get(lessonStorageKey('minusmole'))).toBe(previousSaved);
    const teaching = minus.beginTeaching(state).state;
    store.save('minusmole', teaching);
    expect(store.getSnapshot('minusmole').state.stage).toBe('teach');
    const first = minus.teachExample(teaching, {
      input: { a: '5', b: '-3' },
      proposedAnswer: '8',
    }).state;
    const trained = minus.teachExample(first, {
      input: { a: '-4', b: '3' },
      proposedAnswer: '-7',
    }).state;
    let verify = minus.beginVerification(trained).state;
    for (const question of verify.verification)
      verify = minus.answerVerification(
        verify,
        question.id,
        question.correctAnswer.toString(),
      ).state;
    store.save('minusmole', verify);
    expect(store.getSnapshot('minusmole')).toMatchObject({
      state: { stage: 'complete' },
      saveStatus: 'memory-only',
    });
    expect(
      store.getSummaries().find((item) => item.lessonId === 'minusmole'),
    ).toMatchObject({ status: 'complete', effectiveExamples: 2, verificationPassed: 3 });
  });
  it('cannot create completion by directly changing the stage of a live state', () => {
    const store = createProgressStore(() => undefined);
    const state = progressedStates().minusmole;
    store.save('minusmole', state);
    store.save('minusmole', { ...state, stage: 'complete' });
    expect(store.getSnapshot('minusmole').state.stage).toBe('experiment');
    expect(
      store.getSummaries().find((item) => item.lessonId === 'minusmole')?.status,
    ).toBe('in-progress');
  });
});
