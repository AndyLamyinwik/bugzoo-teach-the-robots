import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumberLine } from './NumberLine';

describe('MinusMole number-line rendering', () => {
  it('renders the actual negative start and rightward motion when subtracting a negative', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: -3n, b: -5n }} ruleId="correct" />,
    );
    expect(markup).toContain('data-start="-3"');
    expect(markup).toContain('data-end="2"');
    expect(markup).toContain('向右 · 5 格');
    expect(markup).toContain('從 -3 開始，最後停在 2');
  });

  it('labels leftward motion and a negative endpoint for ordinary subtraction', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: 2n, b: 5n }} ruleId="correct" />,
    );
    expect(markup).toContain('data-end="-3"');
    expect(markup).toContain('向左 · 5 格');
    expect(markup).toContain('終點 -3');
  });

  it('shows subtraction by zero as stationary without a fake movement arrow', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: -3n, b: 0n }} ruleId="correct" />,
    );
    expect(markup).toContain('data-start="-3"');
    expect(markup).toContain('data-end="-3"');
    expect(markup).toContain('停留 · 0 格');
    expect(markup).toContain('mm-line-stationary');
    expect(markup.includes('class="mm-line-motion-path"')).toBe(false);
  });

  it('marks subtraction of the absolute operand as an incorrect leftward operation', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: 3n, b: -2n }} ruleId="subtract-absolute" />,
    );
    expect(markup).toContain('data-end="1"');
    expect(markup).toContain('向左 · 2 格');
    expect(markup).toContain('錯誤規則示範');
    expect(markup).toContain('錯誤操作');
  });

  it('renders real subtraction followed by a separately marked reflection', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: -3n, b: 2n }} ruleId="absolute-result" />,
    );
    expect(markup).toContain('data-start="-3"');
    expect(markup).toContain('data-end="5"');
    expect(markup).toContain('data-kind="subtract"');
    expect(markup).toContain('data-kind="reflect"');
    expect(markup).toContain('向左 · 2 格');
    expect(markup).toContain('鏡射 · 10 格');
    expect(markup).toContain('mm-line-intermediate-point');
    expect(markup).toContain('這個鏡射不是減法步驟');
    expect(markup.match(/class="mm-line-motion-path"/g)?.length).toBe(2);
  });

  it('keeps the misconception label when this question does not trigger a reflection', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: 5n, b: 2n }} ruleId="absolute-result" />,
    );
    expect(markup).toContain('data-end="3"');
    expect(markup).toContain('錯誤規則示範');
    expect(markup.includes('data-kind="reflect"')).toBe(false);
  });

  it('provides distinct accessible descriptions for multiple number lines on one page', () => {
    const markup = renderToStaticMarkup(
      <div>
        <NumberLine
          input={{ a: 3n, b: -2n }}
          ruleId="subtract-absolute"
          label="鼴鼠的數線"
        />
        <NumberLine input={{ a: 3n, b: -2n }} ruleId="correct" label="正確數線" />
      </div>,
    );
    const descriptionIds = [...markup.matchAll(/aria-describedby="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(descriptionIds).toHaveLength(2);
    expect(new Set(descriptionIds).size).toBe(2);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="鼴鼠的數線：重播動畫"');
    expect(markup).toContain('aria-label="正確數線：略過動畫"');
  });

  it('supplies a static complete server snapshot with a clear motion status', () => {
    const markup = renderToStaticMarkup(
      <NumberLine input={{ a: 3n, b: 2n }} ruleId="correct" />,
    );
    expect(markup).toContain('data-animation="reduced"');
    expect(markup).toContain('data-progress="1"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('減少動態效果設定');
    expect(markup.match(/disabled=""/g)?.length).toBe(2);
  });
});
