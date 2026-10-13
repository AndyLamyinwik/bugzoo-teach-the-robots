import type { RuleId, SubtractionInput } from './rules';

export interface NumberLineSegment {
  readonly from: bigint;
  readonly to: bigint;
  readonly kind: 'subtract' | 'reflect';
  readonly direction: 'left' | 'right' | 'none';
  readonly distance: bigint;
  readonly label: string;
  readonly isMisconception: boolean;
}

export interface NumberLineModel {
  readonly start: bigint;
  readonly end: bigint;
  readonly min: bigint;
  readonly max: bigint;
  readonly ticks: readonly bigint[];
  readonly segments: readonly NumberLineSegment[];
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function segment(
  from: bigint,
  to: bigint,
  kind: NumberLineSegment['kind'],
  label: string,
  isMisconception: boolean,
): NumberLineSegment {
  return {
    from,
    to,
    kind,
    direction: to > from ? 'right' : to < from ? 'left' : 'none',
    distance: absolute(to - from),
    label,
    isMisconception,
  };
}

function floorMultiple(value: bigint, step: bigint): bigint {
  const quotient = value / step;
  return (value < 0n && value % step !== 0n ? quotient - 1n : quotient) * step;
}

/** The rule evaluation and SVG share this exact path; reflection is never a second subtraction. */
export function createNumberLineModel(
  input: SubtractionInput,
  ruleId: RuleId,
): NumberLineModel {
  const { a, b } = input;
  if (a < -20n || a > 20n || b < -20n || b > 20n) {
    throw new RangeError('Number-line operands must lie between -20 and 20.');
  }
  const operand = ruleId === 'subtract-absolute' ? absolute(b) : b;
  const result = a - operand;
  const movement =
    operand < 0n
      ? `往右 ${absolute(operand)} 格`
      : operand > 0n
        ? `往左 ${operand} 格`
        : '不移動';
  const label =
    ruleId === 'subtract-absolute'
      ? `錯誤規則先把減數 ${b} 取絕對值 ${operand}，從 ${a} ${movement}，到達 ${result}。`
      : `從 ${a} 出發，減去 ${b}，${movement}，到達 ${result}。${
          b < 0n
            ? `減去 ${b} 是撤回向左 ${absolute(b)} 格的變化，所以改向右走。`
            : b > 0n
              ? `減去 ${b} 是撤回向右 ${b} 格的變化，所以改向左走。`
              : '零沒有帶來位移，所以減去零仍停在起點。'
        }`;
  const segments = [
    segment(a, result, 'subtract', label, ruleId === 'subtract-absolute'),
  ];
  const end = ruleId === 'absolute-result' && result < 0n ? -result : result;
  if (ruleId === 'absolute-result' && result < 0n) {
    segments.push(
      segment(
        result,
        end,
        'reflect',
        `錯誤規則把負數結果 ${result} 取絕對值，跨過零鏡射到 ${end}；這個鏡射不是減法步驟。`,
        true,
      ),
    );
  }

  const points = [0n, a, ...segments.flatMap((item) => [item.from, item.to])];
  const low = points.reduce((minimum, value) => (value < minimum ? value : minimum)) - 2n;
  const high =
    points.reduce((maximum, value) => (value > maximum ? value : maximum)) + 2n;
  const steps = [1n, 2n, 5n, 10n, 20n];
  for (const step of steps) {
    const min = floorMultiple(low, step);
    const max = -floorMultiple(-high, step);
    if ((max - min) / step + 1n > 9n) continue;
    const ticks: bigint[] = [];
    for (let tick = min; tick <= max; tick += step) ticks.push(tick);
    return { start: a, end, min, max, ticks, segments };
  }
  throw new RangeError('A bounded number-line path must have a displayable range.');
}
