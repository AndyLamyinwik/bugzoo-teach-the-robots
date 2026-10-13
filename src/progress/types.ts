import type { SessionState as FractionState } from '../domain/fractionFox/engine';
import type { SessionState as DiscountState } from '../domain/discountPanda/engine';
import type { SessionState as MinusState } from '../domain/minusMole/engine';
import type { SessionState as ChanceState } from '../domain/chanceCrow/engine';
import type { Stage } from '../domain/teaching/engine';

export const lessonIds = [
  'fractionfox',
  'discountpanda',
  'minusmole',
  'chancecrow',
] as const;
export type LessonId = (typeof lessonIds)[number];
export interface LessonStateMap {
  fractionfox: FractionState;
  discountpanda: DiscountState;
  minusmole: MinusState;
  chancecrow: ChanceState;
}
export type SaveStatus =
  'empty' | 'saved' | 'memory-only' | 'corrupt' | 'unsupported-version';
export interface LessonSnapshot<Id extends LessonId> {
  readonly lessonId: Id;
  readonly state: LessonStateMap[Id];
  readonly saveStatus: SaveStatus;
}
export interface LessonSummary {
  readonly lessonId: LessonId;
  readonly stage: Stage;
  readonly status: 'not-started' | 'in-progress' | 'complete';
  readonly experimentCount: number;
  readonly effectiveExamples: number;
  readonly eliminatedRuleIds: readonly string[];
  readonly verificationPassed: number;
  readonly verificationTotal: 3;
  readonly saveStatus: SaveStatus;
}
/** This boundary is injectable; neither the domain nor the codec needs a browser. */
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
