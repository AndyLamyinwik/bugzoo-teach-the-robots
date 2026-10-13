import { translate } from '../../i18n/messages';
import type { Locale } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useI18n, translateKnownText } from '../../i18n';
import { useId, useState } from 'react';
import {
  colorProbability,
  countColors,
  createBalls,
  createProbabilityModel,
  enumerateSampleSpace,
} from '../../domain/chanceCrow/probability';
import type { Ball, ChanceInput, Color } from '../../domain/chanceCrow/probability';
import {
  createDrawState,
  drawBall,
  empiricalFrequency,
  simulateTrials,
} from '../../domain/chanceCrow/sampling';
import type { DrawState, Trial } from '../../domain/chanceCrow/sampling';
import type { Rational } from '../../domain/math/rational';
import './probability-lab.css';

interface ProbabilityLabProps {
  input: ChanceInput;
  label?: string;
}

interface ProbabilitySnapshotProps {
  input: ChanceInput;
  drawn?: readonly Ball[];
}

interface LabState {
  draw: DrawState;
  trials: number;
  hits: number;
  observations: readonly { trial: Trial; number: number }[];
}

type LabNotice =
  | { readonly key: MessageKey }
  | { readonly key: 'draw'; readonly ball: Ball; readonly completed: boolean };

const colorNames: Record<Color, string> = { red: '紅', blue: '藍' };

function fraction(value: Rational): string {
  return `${value.numerator.toString()}/${value.denominator.toString()}`;
}

function ballLabel(ball: Ball, locale: Locale): string {
  return translate(locale, '{v0}（{v1}球）', {
    v0: ball.id,
    v1: translateKnownText(locale, colorNames[ball.color]),
  });
}

/** Target-event theory and the observed first draw are deliberately separate. */
export function ProbabilityReadout({ input, drawn = [] }: ProbabilitySnapshotProps) {
  const { t, locale } = useI18n();

  const model = createProbabilityModel(input);
  const firstBall = drawn[0];
  const afterActualFirst = firstBall
    ? createBalls(input).filter((ball) => ball.id !== firstBall.id)
    : null;
  const actualCounts = afterActualFirst ? countColors(afterActualFirst) : null;
  const actualConditional = afterActualFirst
    ? colorProbability(afterActualFirst, input.second)
    : null;

  return (
    <div className="cc-probability-readout">
      <h4>{t('理論機率 · 精確答案')}</h4>
      <p className="cc-lab-note">
        {t('目標 A：第一顆是')}
        {translateKnownText(locale, colorNames[input.first])}
        {t('球；目標 B：第二顆是')}
        {translateKnownText(locale, colorNames[input.second])}
        {t('球。')}
      </p>
      <dl className="cc-theory-grid">
        <div>
          <dt>{t('P(A) · 第一顆')}</dt>
          <dd data-probability="first">{fraction(model.firstProbability)}</dd>
          <small>
            {model.firstCount.toString()} / {model.total.toString()}
            {t(' 顆')}
          </small>
        </div>
        <div>
          <dt>{t('P(B | A) · 目標條件')}</dt>
          <dd data-probability="conditional">
            {model.conditionalSecond ? fraction(model.conditionalSecond) : t('未定義')}
          </dd>
          <small>
            {model.remainingCounts
              ? t('假設先抽{v0}球，剩 {v1} / {v2} 顆', {
                  v0: translateKnownText(locale, colorNames[input.first]),
                  v1: model.remainingCounts[input.second].toString(),
                  v2: (model.total - 1n).toString(),
                })
              : t('目標 A 不可能發生')}
          </small>
        </div>
        <div className="cc-theory-joint">
          <dt>{t('P(A 且 B) · 依序兩顆')}</dt>
          <dd data-probability="joint">{fraction(model.joint)}</dd>
          <small>
            {model.conditionalSecond
              ? `${fraction(model.firstProbability)} × ${fraction(model.conditionalSecond)}`
              : t('第一次目標不可能，聯合機率為零')}
          </small>
        </div>
      </dl>
      {!model.conditionalSecond && (
        <p className="cc-zero-event">
          {t('袋中沒有')}
          {translateKnownText(locale, colorNames[input.first])}
          {t(
            '球，不能假設已抽到它；P(B | A) 未定義。 聯合事件不可能，直接得到 0/1，不乘上未定義的條件機率。',
          )}
        </p>
      )}
      <div className="cc-actual-conditional" data-observed-first={firstBall?.id ?? ''}>
        <h4>{t('實際抽到第一顆之後')}</h4>
        {firstBall && actualConditional && actualCounts ? (
          <>
            <p>
              {t('這次第一顆是 ')}
              <strong>{ballLabel(firstBall, locale)}</strong>
              {t('。取走這顆後，剩')}
              {actualCounts.red.toString()}
              {t(' 紅、')}
              {actualCounts.blue.toString()}
              {t(' 藍，共')}
              {(model.total - 1n).toString()}
              {t(' 顆。')}
            </p>
            <p>
              {t('此時第二顆為')}
              {translateKnownText(locale, colorNames[input.second])}
              {t('球的機率是')}{' '}
              <strong data-probability="actual-conditional">
                {fraction(actualConditional)}
              </strong>
              （{actualCounts[input.second].toString()} / {(model.total - 1n).toString()}{' '}
              {t('顆）。')}
            </p>
            <p className="cc-lab-note">
              {t('這個條件是「實際抽到 ')}
              {firstBall.id}
              {t('」，上方 P(B | A) 的條件則是「先抽到')}
              {translateKnownText(locale, colorNames[input.first])}
              {t('球」。只有第一顆的顏色符合 A，兩者才相同。')}
            </p>
          </>
        ) : (
          <p>{t('先抽第一顆，再用真正剩下的球袋計算；結果可能與目標條件不同。')}</p>
        )}
      </div>
    </div>
  );
}

/** Each row and column names a physical ball, including balls of the same color. */
export function ProbabilitySampleSpace({ input, drawn = [] }: ProbabilitySnapshotProps) {
  const { t, locale } = useI18n();

  const spaceId = useId();
  const balls = createBalls(input);
  const outcomes = enumerateSampleSpace(input);
  const indexedOutcomes = new Map(
    outcomes.map((outcome) => [`${outcome.first.id}:${outcome.second.id}`, outcome]),
  );
  const targetCount = outcomes.filter((outcome) => outcome.matchesTarget).length;
  const firstBall = drawn[0];
  const secondBall = drawn[1];

  return (
    <figure className="cc-sample-space" aria-labelledby={`${spaceId}-caption`}>
      <figcaption id={`${spaceId}-caption`}>
        <h4>{t('有序樣本空間 · 每顆球都有自己的 ID')}</h4>
        <p>
          {balls.length} × {balls.length - 1} = <strong>{outcomes.length}</strong>{' '}
          {t('種等可能結果；目標事件佔 ')}
          <strong>{targetCount}</strong>
          {t(' 種。')}
        </p>
      </figcaption>
      <p className="cc-lab-note" id={`${spaceId}-description`}>
        {t(
          '列是第一顆、欄是第二顆。相同 ID 的 × 不可能：同一次試驗不放回。 同色不同 ID 仍是不同的實體球。',
        )}
      </p>
      <div
        className="cc-space-scroll"
        role="region"
        aria-label={t('兩次抽球的實體有序樣本空間')}
        tabIndex={0}
      >
        <table
          className="cc-space-matrix"
          style={{ minWidth: `${(balls.length + 1) * 28}px` }}
          aria-label={t('兩次抽球的實體有序樣本空間')}
          aria-describedby={`${spaceId}-description`}
        >
          <thead>
            <tr>
              <th
                className="cc-space-corner"
                scope="col"
                aria-label={t('第一顆／第二顆')}
              >
                <span aria-hidden="true">1↓ 2→</span>
              </th>
              {balls.map((ball) => (
                <th
                  className="cc-space-label"
                  data-color={ball.color}
                  key={ball.id}
                  scope="col"
                  title={t('第二顆：{v0}', { v0: ballLabel(ball, locale) })}
                >
                  {ball.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balls.map((rowBall) => (
              <tr key={rowBall.id}>
                <th
                  className="cc-space-label"
                  data-color={rowBall.color}
                  scope="row"
                  title={t('第一顆：{v0}', { v0: ballLabel(rowBall, locale) })}
                >
                  {rowBall.id}
                </th>
                {balls.map((columnBall) => {
                  const outcome = indexedOutcomes.get(`${rowBall.id}:${columnBall.id}`);
                  const active = Boolean(
                    outcome && (!firstBall || firstBall.id === rowBall.id),
                  );
                  const observed = Boolean(
                    outcome &&
                    firstBall?.id === rowBall.id &&
                    secondBall?.id === columnBall.id,
                  );
                  const description = t('第一顆 {v0}，第二顆 {v1}；{v2}。', {
                    v0: ballLabel(rowBall, locale),
                    v1: ballLabel(columnBall, locale),
                    v2: outcome
                      ? `${outcome.matchesTarget ? t('符合目標') : t('不符合目標')}${observed ? t('；本次抽球結果') : firstBall ? (active ? t('；已知第一顆後仍可能') : t('；已知第一顆後排除')) : ''}`
                      : t('不可能：同一顆球不能再抽'),
                  });
                  return (
                    <td
                      className="cc-space-cell"
                      data-first={rowBall.id}
                      data-second={columnBall.id}
                      data-possible={Boolean(outcome)}
                      data-target={outcome?.matchesTarget ?? false}
                      data-active={active}
                      data-observed={observed}
                      key={columnBall.id}
                      aria-label={description}
                      title={description}
                    >
                      <span aria-hidden="true">
                        {outcome ? (observed ? '✓' : '●') : '×'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cc-space-legend" aria-hidden="true">
        <span>
          <i data-kind="target" />
          {t(' 目標事件')}
        </span>
        <span>
          <i data-kind="active" />
          {t(' 仍可能')}
        </span>
        <span>
          <i data-kind="observed" />
          {t(' 本次結果')}
        </span>
      </div>
      <p className="cc-space-status" role="status">
        {firstBall
          ? t('已知第一顆是 {v0}，樣本空間縮為 {v1} 種第二顆候選。{v2}', {
              v0: firstBall.id,
              v1: balls.length - 1,
              v2: secondBall
                ? t('這次觀察到 {v0} → {v1}。', { v0: firstBall.id, v1: secondBall.id })
                : '',
            })
          : t('尚未抽球，{v0} 種有序結果都可能。', { v0: outcomes.length })}
      </p>
    </figure>
  );
}

function BagDrawing({
  state,
  replay,
  motionSkipped,
}: {
  state: DrawState;
  replay: number;
  motionSkipped: boolean;
}) {
  const { t, locale } = useI18n();

  const bagId = useId();
  return (
    <svg
      className="cc-bag-svg"
      data-skip-motion={motionSkipped}
      viewBox="0 0 300 246"
      role="img"
      aria-labelledby={`${bagId}-title`}
      aria-describedby={`${bagId}-description`}
    >
      <title id={`${bagId}-title`}>{t('不放回抽球袋與兩顆抽球結果')}</title>
      <desc id={`${bagId}-description`}>
        {t('袋中剩 ')}
        {state.remaining.length}
        {t(' 顆球：')}
        {state.remaining.map((ball) => ballLabel(ball, locale)).join(t('、'))}
        {t('。')}
        {state.drawn.length === 0
          ? t('尚未抽球。')
          : t('抽出順序：{v0}。', {
              v0: state.drawn.map((ball) => ballLabel(ball, locale)).join(t('，再抽到')),
            })}
      </desc>
      <ellipse className="cc-bag-shadow" cx="101" cy="232" rx="78" ry="7" />
      <path
        className="cc-bag-fabric"
        d="M48 52 32 71C16 103 18 180 23 210Q26 230 102 230Q177 230 180 210C186 180 187 103 171 71L155 52Z"
      />
      <path className="cc-bag-fold" d="M35 80Q25 165 37 207M165 80Q177 165 166 207" />
      <path className="cc-bag-mouth" d="M48 52 42 30Q101 10 162 30L155 52Z" />
      <path
        className="cc-bag-tie"
        d="M45 53Q103 67 157 53M136 60Q163 63 178 47M136 60 168 77"
      />
      <text className="cc-bag-brand" x="101" y="42" textAnchor="middle">
        CHANCE LAB
      </text>
      {state.remaining.map((ball, index) => (
        <g
          key={ball.id}
          transform={`translate(${49 + (index % 3) * 51} ${91 + Math.floor(index / 3) * 37})`}
        >
          <circle className="cc-physical-ball" data-color={ball.color} r="16">
            <title>{t('袋中的 {v0}', { v0: ballLabel(ball, locale) })}</title>
          </circle>
          <circle className="cc-ball-glint" cx="-9" cy="-9" r="2" />
          <text className="cc-ball-id" textAnchor="middle" y="4">
            {ball.id}
          </text>
        </g>
      ))}
      {[0, 1].map((index) => {
        const ball = state.drawn[index];
        const y = index === 0 ? 102 : 193;
        return (
          <g key={index}>
            <text className="cc-draw-slot-label" x="241" y={y - 39} textAnchor="middle">
              {t('第 ')}
              {index + 1}
              {t(' 顆')}
            </text>
            <circle className="cc-draw-slot" cx="241" cy={y} r="27" />
            {ball ? (
              <g
                className="cc-drawn-ball"
                data-step={index + 1}
                key={`${replay}:${ball.id}`}
                style={{ transformOrigin: `241px ${y}px` }}
              >
                <circle
                  className="cc-physical-ball"
                  data-color={ball.color}
                  cx="241"
                  cy={y}
                  r="22"
                >
                  <title>
                    {t('第 {v0} 顆：{v1}', {
                      v0: index + 1,
                      v1: ballLabel(ball, locale),
                    })}
                  </title>
                </circle>
                <circle className="cc-ball-glint" cx="227" cy={y - 12} r="3" />
                <text
                  className="cc-ball-id cc-drawn-id"
                  x="241"
                  y={y + 5}
                  textAnchor="middle"
                >
                  {ball.id}
                </text>
              </g>
            ) : (
              <text className="cc-draw-empty" x="241" y={y + 5} textAnchor="middle">
                ?
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function InteractiveProbabilityLab({
  input,
  label = '互動式抽球實驗室',
}: ProbabilityLabProps) {
  const { t, locale } = useI18n();

  const labId = useId();
  const [state, setState] = useState<LabState>(() => ({
    draw: createDrawState(input),
    trials: 0,
    hits: 0,
    observations: [],
  }));
  const [replay, setReplay] = useState(0);
  const [motionSkipped, setMotionSkipped] = useState(false);
  const [notice, setNotice] = useState<LabNotice>({
    key: '每一顆實體球都等可能被抽到。',
  });
  const remainingCounts = countColors(state.draw.remaining);
  const frequency = empiricalFrequency(state.trials, state.hits);
  const firstBall = state.draw.drawn[0];
  const secondBall = state.draw.drawn[1];

  function drawNextBall() {
    const nextDraw = drawBall(state.draw, Math.random);
    const completedNow = state.draw.drawn.length === 1 && nextDraw.drawn.length === 2;
    const first = nextDraw.drawn[0];
    const second = nextDraw.drawn[1];
    const completedTrial =
      completedNow && first && second && nextDraw.matchesTarget !== null
        ? { first, second, matchesTarget: nextDraw.matchesTarget }
        : null;
    setState({
      draw: nextDraw,
      trials: state.trials + (completedNow ? 1 : 0),
      hits: state.hits + (completedNow && nextDraw.matchesTarget ? 1 : 0),
      observations: completedTrial
        ? [
            ...state.observations,
            { trial: completedTrial, number: state.trials + 1 },
          ].slice(-5)
        : state.observations,
    });
    setMotionSkipped(false);
    const drawnBall = nextDraw.drawn.at(-1);
    setNotice(
      drawnBall
        ? { key: 'draw', ball: drawnBall, completed: completedNow }
        : { key: '每一顆實體球都等可能被抽到。' },
    );
  }

  function beginNextTrial() {
    setState({ ...state, draw: createDrawState(input) });
    setNotice({ key: '球袋已恢復。已完成的試驗次數保留；未完成的一組不計入。' });
    setMotionSkipped(false);
  }

  function runBatch() {
    const result = simulateTrials(input, 50, Math.random);
    const lastDrawn = [result.lastTrial.first, result.lastTrial.second];
    setState({
      draw: {
        input,
        remaining: createBalls(input).filter(
          (ball) => !lastDrawn.some((drawnBall) => drawnBall.id === ball.id),
        ),
        drawn: lastDrawn,
        matchesTarget: result.lastTrial.matchesTarget,
      },
      trials: state.trials + result.trials,
      hits: state.hits + result.hits,
      observations: [
        ...state.observations,
        { trial: result.lastTrial, number: state.trials + result.trials },
      ].slice(-5),
    });
    setReplay((value) => value + 1);
    setMotionSkipped(false);
    setNotice({
      key: '完成 50 次完整試驗；每次開始都恢復原球袋。畫面保留最後一組抽球結果。',
    });
  }

  function resetExperiment() {
    setState({ draw: createDrawState(input), trials: 0, hits: 0, observations: [] });
    setReplay(0);
    setMotionSkipped(false);
    setNotice({ key: '球袋、抽球結果與經驗頻率已全部重設。' });
  }

  return (
    <section className="cc-probability-lab" aria-labelledby={`${labId}-heading`}>
      <div className="cc-lab-heading">
        <span className="cc-lab-kicker">DRAW · OBSERVE · EXPLAIN</span>
        <h3 id={`${labId}-heading`}>{translateKnownText(locale, label)}</h3>
        <p>{t('先抽兩顆，看看球袋怎麼變；再用樣本空間解釋機率。')}</p>
      </div>
      <div className="cc-lab-observation">
        <div className="cc-bag-panel">
          <div className="cc-bag-counts" aria-label={t('目前球袋剩餘球數')}>
            <span data-color="red">
              {t('紅 ')}
              {remainingCounts.red.toString()}
            </span>
            <span data-color="blue">
              {t('藍 ')}
              {remainingCounts.blue.toString()}
            </span>
            <strong>
              {t('共 ')}
              {state.draw.remaining.length}
              {t(' 顆')}
            </strong>
          </div>
          <BagDrawing state={state.draw} replay={replay} motionSkipped={motionSkipped} />
          <p className="cc-draw-result" role="status">
            {firstBall
              ? secondBall
                ? t('本次結果：{v0} → {v1}，{v2}目標事件。', {
                    v0: firstBall.id,
                    v1: secondBall.id,
                    v2: state.draw.matchesTarget ? t('符合') : t('不符合'),
                  })
                : t('第一顆：{v0}。球袋已少一顆，第二顆仍待抽出。', {
                    v0: ballLabel(firstBall, locale),
                  })
              : t('單次隨機結果 · 尚未抽球')}
          </p>
          <div className="cc-draw-controls">
            <button
              aria-label={t('{v0}：抽第一顆', { v0: label })}
              className="ff-button"
              disabled={state.draw.drawn.length !== 0}
              onClick={drawNextBall}
              type="button"
            >
              {t('抽第一顆')}
            </button>
            <button
              aria-label={t('{v0}：抽第二顆', { v0: label })}
              className="ff-button"
              disabled={state.draw.drawn.length !== 1}
              onClick={drawNextBall}
              type="button"
            >
              {t('抽第二顆')}
            </button>
          </div>
          <div className="cc-animation-controls">
            <button
              aria-label={t('{v0}：重播抽球動畫', { v0: label })}
              disabled={state.draw.drawn.length === 0}
              onClick={() => {
                setReplay((value) => value + 1);
                setMotionSkipped(false);
                setNotice({ key: '重播同一組抽球順序，不重新抽球，也不增加試驗次數。' });
              }}
              type="button"
            >
              {t('重播抽球動畫')}
            </button>
            <button
              aria-label={t('{v0}：略過動畫', { v0: label })}
              disabled={state.draw.drawn.length === 0 || motionSkipped}
              onClick={() => setMotionSkipped(true)}
              type="button"
            >
              {t('略過動畫')}
            </button>
          </div>
          <p className="cc-lab-note">
            {t('重播只播放原結果；減少動態效果設定會直接顯示抽出的球。')}
          </p>
        </div>
        <ProbabilityReadout input={input} drawn={state.draw.drawn} />
      </div>
      <p className="cc-lab-announcement" role="status">
        {notice.key === 'draw'
          ? t('抽到 {v0}，這顆已從球袋移除。{v1}', {
              v0: ballLabel(notice.ball, locale),
              v1: notice.completed
                ? t('兩顆都抽完，計入一次完整試驗。')
                : t('第一顆還不算完整試驗。'),
            })
          : t(notice.key)}
      </p>
      <div className="cc-trial-controls">
        <button
          aria-label={t('{v0}：新一次試驗（恢復球袋）', { v0: label })}
          className="ff-button ff-button-secondary"
          onClick={beginNextTrial}
          type="button"
        >
          {t('新一次試驗（恢復球袋）')}
        </button>
        <button
          aria-label={t('{v0}：連做 50 次完整試驗', { v0: label })}
          className="ff-button ff-button-secondary"
          disabled={state.draw.drawn.length === 1}
          onClick={runBatch}
          type="button"
        >
          {t('連做 50 次完整試驗')}
        </button>
        <button
          aria-label={t('{v0}：重設實驗與次數', { v0: label })}
          className="cc-reset-lab"
          onClick={resetExperiment}
          type="button"
        >
          {t('重設實驗與次數')}
        </button>
      </div>
      <div className="cc-frequency-panel">
        <div>
          <h4>{t('經驗頻率 · 隨機觀察')}</h4>
          <p>
            {t('完成 ')}
            <strong data-trial-count={state.trials}>{state.trials}</strong>
            {t(' 次，符合 目標 ')}
            <strong>{state.hits}</strong>
            {t(' 次。')}
          </p>
        </div>
        <strong
          className="cc-frequency-value"
          data-frequency={frequency ? fraction(frequency) : 'none'}
        >
          {frequency
            ? `${state.hits}/${state.trials} = ${fraction(frequency)}`
            : t('尚無完整試驗')}
        </strong>
        <p className="cc-lab-note">
          {t(
            '每次完整試驗之間都恢復原球袋，同一次的兩顆不放回。頻率會隨隨機結果波動， 不是理論機率，也不能作為精確教學答案或排除規則的證據。',
          )}
        </p>
      </div>
      {state.observations.length > 0 && (
        <details className="cc-observation-history">
          <summary>{t('最近的完整試驗觀察')}</summary>
          <ol>
            {state.observations.map(({ trial, number }) => (
              <li key={number}>
                {t('第 ')}
                {number}
                {t(' 次：')}
                {ballLabel(trial.first, locale)} → {ballLabel(trial.second, locale)} ·{' '}
                {trial.matchesTarget ? t('符合') : t('不符合')}
                {t('目標')}
              </li>
            ))}
          </ol>
          <p className="cc-lab-note">
            {t('最多保留 5 組；連做 50 次時只保留該批次最後一組，頻率仍計入全部 50 次。')}
          </p>
        </details>
      )}
      <ProbabilitySampleSpace input={input} drawn={state.draw.drawn} />
    </section>
  );
}

export function ProbabilityLab({
  input,
  label = '互動式抽球實驗室',
}: ProbabilityLabProps) {
  const { locale } = useI18n();

  return (
    <InteractiveProbabilityLab
      key={`${input.red.toString()}:${input.blue.toString()}:${input.first}:${input.second}`}
      input={input}
      label={translateKnownText(locale, label)}
    />
  );
}
