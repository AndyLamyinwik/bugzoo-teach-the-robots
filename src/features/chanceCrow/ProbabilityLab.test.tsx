import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChanceInput } from '../../domain/chanceCrow/probability';
import { createDrawState, drawBall } from '../../domain/chanceCrow/sampling';
import {
  ProbabilityLab,
  ProbabilityReadout,
  ProbabilitySampleSpace,
} from './ProbabilityLab';

const input: ChanceInput = { red: 3n, blue: 1n, first: 'red', second: 'blue' };

function matrixCells(markup: string): readonly string[] {
  return [...markup.matchAll(/<td ([^>]*)>/g)].map((match) => match[1] ?? '');
}

function cellFor(cells: readonly string[], first: string, second: string): string {
  return (
    cells.find(
      (cell) =>
        cell.includes(`data-first="${first}"`) &&
        cell.includes(`data-second="${second}"`),
    ) ?? ''
  );
}

describe('ChanceCrow probability laboratory rendering', () => {
  it('renders exact target probabilities while keeping empirical frequency unobserved', () => {
    const markup = renderToStaticMarkup(<ProbabilityLab input={input} />);
    expect(markup).toContain('data-probability="first">3/4');
    expect(markup).toContain('data-probability="conditional">1/3');
    expect(markup).toContain('data-probability="joint">1/4');
    expect(markup).toContain('data-trial-count="0">0');
    expect(markup).toContain('data-frequency="none">尚無完整試驗');
    expect(markup).toContain('不是理論機率，也不能作為精確教學答案或排除規則的證據');
    expect(markup).toContain('目標 A：第一顆是紅球；目標 B：第二顆是藍球');
    expect(markup).toContain('目前球袋剩餘球數');
  });

  it('uses the smaller same-color numerator after removing the first target ball', () => {
    const sameColor: ChanceInput = { ...input, second: 'red' };
    const markup = renderToStaticMarkup(<ProbabilityReadout input={sameColor} />);
    expect(markup).toContain('data-probability="first">3/4');
    expect(markup).toContain('data-probability="conditional">2/3');
    expect(markup).toContain('data-probability="joint">1/2');
    expect(markup).toContain('假設先抽紅球，剩 2 / 3 顆');
  });

  it('labels an impossible first event as undefined and explains the zero joint directly', () => {
    const zeroFirst: ChanceInput = { red: 0n, blue: 3n, first: 'red', second: 'blue' };
    const markup = renderToStaticMarkup(<ProbabilityReadout input={zeroFirst} />);
    expect(markup).toContain('data-probability="first">0/1');
    expect(markup).toContain('data-probability="conditional">未定義');
    expect(markup).toContain('data-probability="joint">0/1');
    expect(markup).toContain('不乘上未定義的條件機率');
    expect(markup.includes('0/1 ×')).toBe(false);
  });

  it('keeps a possible first event and a zero second event mathematically distinct', () => {
    const zeroSecond: ChanceInput = { red: 3n, blue: 0n, first: 'red', second: 'blue' };
    const markup = renderToStaticMarkup(<ProbabilityReadout input={zeroSecond} />);
    expect(markup).toContain('data-probability="first">1/1');
    expect(markup).toContain('data-probability="conditional">0/1');
    expect(markup).toContain('data-probability="joint">0/1');
    expect(markup.includes('未定義')).toBe(false);
  });

  it('renders equal-color physical IDs as distinct ordered outcomes and excludes the diagonal', () => {
    const small: ChanceInput = { red: 2n, blue: 1n, first: 'red', second: 'red' };
    const markup = renderToStaticMarkup(<ProbabilitySampleSpace input={small} />);
    const cells = matrixCells(markup);
    expect(cells).toHaveLength(9);
    expect(cells.filter((cell) => cell.includes('data-possible="true"'))).toHaveLength(6);
    expect(cells.filter((cell) => cell.includes('data-target="true"'))).toHaveLength(2);
    expect(cellFor(cells, 'R1', 'R2')).toContain('data-target="true"');
    expect(cellFor(cells, 'R2', 'R1')).toContain('data-target="true"');
    expect(cellFor(cells, 'R1', 'R1')).toContain('data-possible="false"');
    expect(cellFor(cells, 'B1', 'B1')).toContain('不可能：同一顆球不能再抽');
    expect(markup).toContain('第二顆：R2（紅球）');
    expect(markup).toContain('第一顆：R1（紅球）');
  });

  it('shrinks the active physical sample space to N-1 outcomes after the actual first draw', () => {
    const draw = drawBall(createDrawState(input), () => 0);
    const markup = renderToStaticMarkup(
      <ProbabilitySampleSpace input={input} drawn={draw.drawn} />,
    );
    const cells = matrixCells(markup);
    expect(cells.filter((cell) => cell.includes('data-possible="true"'))).toHaveLength(
      12,
    );
    expect(cells.filter((cell) => cell.includes('data-active="true"'))).toHaveLength(3);
    expect(cellFor(cells, 'R1', 'R2')).toContain('data-active="true"');
    expect(cellFor(cells, 'R2', 'R1')).toContain('data-active="false"');
    expect(markup).toContain('已知第一顆是 R1，樣本空間縮為 3 種第二顆候選');
  });

  it('marks exactly one observed pair after two draws while retaining the original theory', () => {
    const first = drawBall(createDrawState(input), () => 0);
    const completed = drawBall(first, () => 0.99);
    const markup = renderToStaticMarkup(
      <ProbabilitySampleSpace input={input} drawn={completed.drawn} />,
    );
    const cells = matrixCells(markup);
    expect(cells.filter((cell) => cell.includes('data-observed="true"'))).toHaveLength(1);
    expect(cellFor(cells, 'R1', 'B1')).toContain('data-observed="true"');
    expect(cellFor(cells, 'R1', 'B1')).toContain('data-target="true"');
    expect(markup).toContain('這次觀察到 R1 → B1');
    const readout = renderToStaticMarkup(
      <ProbabilityReadout input={input} drawn={completed.drawn} />,
    );
    expect(readout).toContain('data-probability="joint">1/4');
    expect(readout).toContain('data-probability="actual-conditional">1/3');
  });

  it('separates actual first-ball probability from the hypothetical target condition', () => {
    const observedBlue = drawBall(createDrawState(input), () => 0.99);
    const markup = renderToStaticMarkup(
      <ProbabilityReadout input={input} drawn={observedBlue.drawn} />,
    );
    expect(markup).toContain('data-probability="conditional">1/3');
    expect(markup).toContain('data-observed-first="B1"');
    expect(markup).toContain('data-probability="actual-conditional">0/1');
    expect(markup).toContain('剩3 紅、0 藍，共3 顆');
    expect(markup).toContain('只有第一顆的顏色符合 A，兩者才相同');
  });

  it('can show a defined actual condition even when the target first event is impossible', () => {
    const impossible: ChanceInput = { red: 0n, blue: 2n, first: 'red', second: 'blue' };
    const actual = drawBall(createDrawState(impossible), () => 0);
    const markup = renderToStaticMarkup(
      <ProbabilityReadout input={impossible} drawn={actual.drawn} />,
    );
    expect(markup).toContain('data-probability="conditional">未定義');
    expect(markup).toContain('data-probability="joint">0/1');
    expect(markup).toContain('data-probability="actual-conditional">1/1');
  });

  it('renders all 132 legal ordered outcomes for the largest allowed physical bag', () => {
    const maximum: ChanceInput = { red: 10n, blue: 2n, first: 'red', second: 'blue' };
    const cells = matrixCells(
      renderToStaticMarkup(<ProbabilitySampleSpace input={maximum} />),
    );
    expect(cells).toHaveLength(144);
    expect(cells.filter((cell) => cell.includes('data-possible="true"'))).toHaveLength(
      132,
    );
    expect(cells.filter((cell) => cell.includes('data-possible="false"'))).toHaveLength(
      12,
    );
    expect(cells.filter((cell) => cell.includes('data-target="true"'))).toHaveLength(20);
    expect(cellFor(cells, 'R10', 'B2')).toContain('data-target="true"');
  });

  it('does not draw random samples when rendering theory or a fresh laboratory', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Rendering must not sample physical balls.');
    });
    try {
      const markup = renderToStaticMarkup(<ProbabilityLab input={input} />);
      expect(random.mock.calls).toHaveLength(0);
      expect(markup).toContain(
        '袋中剩 4 顆球：R1（紅球）、R2（紅球）、R3（紅球）、B1（藍球）',
      );
      expect(markup).toContain('單次隨機結果 · 尚未抽球');
    } finally {
      random.mockRestore();
    }
  });

  it('provides unique accessible SVG descriptions and named controls for separate laboratories', () => {
    const markup = renderToStaticMarkup(
      <div>
        <ProbabilityLab input={input} label="觀察用實驗室" />
        <ProbabilityLab input={input} label="教學用實驗室" />
      </div>,
    );
    const descriptionIds = [
      ...markup.matchAll(/<svg[^>]*aria-describedby="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(descriptionIds).toHaveLength(2);
    expect(new Set(descriptionIds).size).toBe(2);
    expect(markup).toContain('aria-label="觀察用實驗室：抽第一顆"');
    expect(markup).toContain('aria-label="教學用實驗室：抽第二顆"');
    expect(markup).toContain('aria-label="教學用實驗室：重設實驗與次數"');
  });
});
