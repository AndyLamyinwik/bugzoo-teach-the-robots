import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createSession } from '../domain/fractionFox/engine';
import { useLessonProgress, useLessonProgressStatus, useProgressStore } from './hooks';

function Probe() {
  const [state] = useLessonProgress('fractionfox', createSession);
  const status = useLessonProgressStatus('fractionfox');
  return (
    <output>
      {state.stage}:{status}
    </output>
  );
}
function SummaryProbe() {
  const summaries = useProgressStore();
  return (
    <output>
      {summaries
        .map((item) => `${item.lessonId}:${item.status}:${item.saveStatus}`)
        .join(',')}
    </output>
  );
}
describe('server and StrictMode-safe progress initialization', () => {
  it('renders the initial domain session without accessing browser storage', () => {
    const access = vi.fn(() => {
      throw new Error('SSR must not access localStorage');
    });
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: access }));
    try {
      expect(
        renderToStaticMarkup(
          <StrictMode>
            <Probe />
          </StrictMode>,
        ),
      ).toContain('observe:empty');
      expect(access).toHaveBeenCalledTimes(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('renders all four real initial summaries on the server without reporting storage failures', () => {
    expect(renderToStaticMarkup(<SummaryProbe />)).toContain(
      'fractionfox:not-started:empty,discountpanda:not-started:empty,minusmole:not-started:empty,chancecrow:not-started:empty',
    );
  });
});
