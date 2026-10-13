import { localizeNumberLineLabel } from '../../i18n/domainPresentation';
import { translate } from '../../i18n/messages';
import type { Locale } from '../../i18n';
import { useI18n, translateKnownText } from '../../i18n';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createNumberLineModel } from '../../domain/minusMole/numberLine';
import type {
  NumberLineModel,
  NumberLineSegment,
} from '../../domain/minusMole/numberLine';
import type { RuleId, SubtractionInput } from '../../domain/minusMole/engine';
import './number-line.css';

interface NumberLineProps {
  input: SubtractionInput;
  ruleId: RuleId;
  label?: string;
}

interface AnimatedNumberLineProps {
  model: NumberLineModel;
  ruleId: RuleId;
  label: string;
}

const motionQuery = '(prefers-reduced-motion: reduce)';
const directions = { left: '向左', right: '向右', none: '停留' } as const;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia(motionQuery).matches;
}

function serverReducedMotionSnapshot() {
  return true;
}

function movementLabel(segment: NumberLineSegment, locale: Locale): string {
  return translate(locale, '{v0} · {v1} 格', {
    v0: translateKnownText(
      locale,
      segment.kind === 'reflect'
        ? '鏡射'
        : translateKnownText(locale, directions[segment.direction]),
    ),
    v1: segment.distance.toString(),
  });
}

/** Domain values drive the drawing; animation coordinates never determine an answer. */
function AnimatedNumberLine({ model, ruleId, label }: AnimatedNumberLineProps) {
  const { t, locale } = useI18n();

  const lineId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [progress, setProgress] = useState(0);
  const [replay, setReplay] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    serverReducedMotionSnapshot,
  );

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(160, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || skipped) return;
    let frameId = 0;
    let startedAt: number | null = null;
    const duration = model.segments.length * 1500;
    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const nextProgress = Math.min((timestamp - startedAt) / duration, 1);
      setProgress(nextProgress);
      if (nextProgress < 1) frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [model.segments.length, reducedMotion, replay, skipped]);

  const visibleProgress = reducedMotion || skipped ? 1 : progress;
  const finished = visibleProgress === 1;
  const segmentIndex = Math.min(
    Math.floor(visibleProgress * model.segments.length),
    model.segments.length - 1,
  );
  const activeSegment = model.segments[segmentIndex];
  const isWrongRule = ruleId !== 'correct';
  const axisY = 130;
  const margin = 26;
  const drawableWidth = width - margin * 2;
  // The domain model contains only bounded integers. Numbers here are SVG geometry.
  const x = (value: bigint) =>
    margin + (Number(value - model.min) / Number(model.max - model.min)) * drawableWidth;
  const coordinate = (value: number) => Math.max(margin, Math.min(width - margin, value));
  const labelTicks: bigint[] = [];
  const primaryTicks = [0n, model.ticks[0], model.ticks.at(-1)];
  for (const tick of [...primaryTicks, ...model.ticks]) {
    if (tick === undefined || !model.ticks.includes(tick)) continue;
    if (labelTicks.every((previous) => Math.abs(x(previous) - x(tick)) >= 36))
      labelTicks.push(tick);
  }
  const currentProgress = Math.min(
    1,
    Math.max(0, visibleProgress * model.segments.length - segmentIndex),
  );
  const currentX = activeSegment
    ? x(activeSegment.from) +
      (x(activeSegment.to) - x(activeSegment.from)) * currentProgress
    : x(model.start);
  const description = t('從 {v0} 開始，最後停在 {v1}。{v2}', {
    v0: model.start.toString(),
    v1: model.end.toString(),
    v2: model.segments
      .map((segment) =>
        t('{v0}；{v1} {v2} 格{v3}。', {
          v0: localizeNumberLineLabel(segment, locale),
          v1: translateKnownText(locale, directions[segment.direction]),
          v2: segment.distance.toString(),
          v3: segment.isMisconception ? t('，這是錯誤操作') : '',
        }),
      )
      .join(''),
  });
  const status = reducedMotion
    ? t('已依減少動態效果設定顯示完整數線。')
    : finished
      ? t('數線動畫已完成。')
      : t('正在演示第 {v0} 步：{v1}。', {
          v0: segmentIndex + 1,
          v1: activeSegment ? movementLabel(activeSegment, locale) : t('數線起點'),
        });

  function replayAnimation() {
    setProgress(0);
    setSkipped(false);
    setReplay((value) => value + 1);
  }

  return (
    <figure
      className="mm-number-line"
      aria-labelledby={`${lineId}-caption`}
      data-rule={ruleId}
      data-start={model.start.toString()}
      data-end={model.end.toString()}
      data-animation={
        reducedMotion
          ? 'reduced'
          : skipped
            ? 'skipped'
            : finished
              ? 'complete'
              : 'running'
      }
      data-progress={visibleProgress}
      data-step={segmentIndex + 1}
    >
      <figcaption className="mm-line-heading" id={`${lineId}-caption`}>
        <strong>{translateKnownText(locale, label)}</strong>
        <span className="mm-line-badge" data-wrong={isWrongRule}>
          {isWrongRule ? t('錯誤規則示範') : t('正確規則')}
        </span>
      </figcaption>
      <p className="mm-line-summary">
        {t('起點 ')}
        <strong>{model.start.toString()}</strong>
        <span aria-hidden="true">→</span>
        {t('終點 ')}
        <strong>{model.end.toString()}</strong>
      </p>
      <div className="mm-line-canvas" ref={container}>
        <svg
          aria-labelledby={`${lineId}-title`}
          aria-describedby={`${lineId}-description`}
          className="mm-line-svg"
          role="img"
          viewBox={`0 0 ${width} 190`}
        >
          <title id={`${lineId}-title`}>{translateKnownText(locale, label)}</title>
          <desc id={`${lineId}-description`}>{description}</desc>
          <line className="mm-line-zero" x1={x(0n)} x2={x(0n)} y1="18" y2="141" />
          <line className="mm-line-axis" x1="12" x2={width - 12} y1={axisY} y2={axisY} />
          <path
            className="mm-line-axis-head"
            d={`M18 126 12 130 18 134M${width - 18} 126 ${width - 12} 130 ${width - 18} 134`}
          />
          {model.ticks.map((tick) => (
            <g key={tick.toString()}>
              <line
                className="mm-line-tick"
                x1={x(tick)}
                x2={x(tick)}
                y1={axisY - 4}
                y2={axisY + 6}
              />
              {labelTicks.includes(tick) && (
                <text className="mm-line-tick-label" x={x(tick)} y="154">
                  {tick.toString()}
                </text>
              )}
            </g>
          ))}
          {model.segments.map((segment, index) => {
            const stepProgress = Math.min(
              1,
              Math.max(0, visibleProgress * model.segments.length - index),
            );
            const fromX = x(segment.from);
            const toX = x(segment.to);
            const rise = segment.kind === 'reflect' ? 80 : 44;
            const controlY = axisY - rise * 2;
            const controlX = (fromX + toX) / 2;
            const tipX = fromX + (toX - fromX) * stepProgress;
            const tipY =
              axisY + 2 * (1 - stepProgress) * stepProgress * (controlY - axisY);
            const partialControlX = fromX + (controlX - fromX) * stepProgress;
            const partialControlY = axisY + (controlY - axisY) * stepProgress;
            const angle = Math.atan2(
              2 * (1 - 2 * stepProgress) * (controlY - axisY),
              toX - fromX,
            );
            const headX = tipX - Math.cos(angle) * 8;
            const headY = tipY - Math.sin(angle) * 8;
            const sideX = Math.sin(angle) * 3.8;
            const sideY = Math.cos(angle) * 3.8;

            return (
              <g
                className="mm-line-motion"
                data-wrong={segment.isMisconception}
                data-kind={segment.kind}
                key={`${segment.kind}-${index}`}
              >
                <text
                  className="mm-line-movement-label"
                  x={coordinate(controlX)}
                  y={segment.kind === 'reflect' ? 34 : 72}
                >
                  {movementLabel(segment, locale)}
                </text>
                {segment.direction === 'none' ? (
                  <circle className="mm-line-stationary" cx={fromX} cy={axisY} r="10" />
                ) : stepProgress > 0 ? (
                  <>
                    <path
                      className="mm-line-motion-path"
                      d={`M${fromX} ${axisY} Q${partialControlX} ${partialControlY} ${tipX} ${tipY}`}
                    />
                    <polygon
                      className="mm-line-arrow"
                      points={`${tipX},${tipY} ${headX + sideX},${headY - sideY} ${headX - sideX},${headY + sideY}`}
                    />
                  </>
                ) : null}
              </g>
            );
          })}
          {model.segments.length > 1 &&
            visibleProgress * model.segments.length >= 1 &&
            model.segments[0] && (
              <circle
                className="mm-line-intermediate-point"
                cx={x(model.segments[0].to)}
                cy={axisY}
                r="4"
              >
                <title>
                  {t('減法先到 ')}
                  {model.segments[0].to.toString()}
                  {t('，再執行錯誤的鏡射。')}
                </title>
              </circle>
            )}
          <circle className="mm-line-start-point" cx={x(model.start)} cy={axisY} r="5" />
          <circle
            className="mm-line-current-point"
            data-wrong={activeSegment?.isMisconception ?? false}
            cx={currentX}
            cy={axisY}
            r="6"
          />
          <text className="mm-line-point-label" x={coordinate(x(model.start))} y="177">
            {t('起點 ')}
            {model.start.toString()}
          </text>
          {finished && (
            <text className="mm-line-end-label" x={coordinate(x(model.end))} y="113">
              {t('終點 ')}
              {model.end.toString()}
            </text>
          )}
        </svg>
      </div>
      <ol className="mm-line-steps">
        {model.segments.map((segment, index) => (
          <li data-wrong={segment.isMisconception} key={`${segment.kind}-${index}`}>
            <span className="mm-line-step-index" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{localizeNumberLineLabel(segment, locale)}</strong>
              <p>
                {segment.from.toString()} → {segment.to.toString()} ·{' '}
                {translateKnownText(locale, directions[segment.direction])}{' '}
                {segment.distance.toString()}
                {t(' 格')}
                {segment.isMisconception && t(' · 錯誤操作')}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mm-line-controls">
        <button
          aria-label={t('{v0}：重播動畫', { v0: label })}
          className="mm-line-button"
          disabled={reducedMotion}
          onClick={replayAnimation}
          type="button"
        >
          {t('重播動畫')}
        </button>
        <button
          aria-label={t('{v0}：略過動畫', { v0: label })}
          className="mm-line-button"
          disabled={finished}
          onClick={() => setSkipped(true)}
          type="button"
        >
          {t('略過動畫')}
        </button>
      </div>
      <p className="mm-line-status" role="status">
        {status}
      </p>
    </figure>
  );
}

export function NumberLine({ input, ruleId, label = '數線推理' }: NumberLineProps) {
  const { locale } = useI18n();

  const model = createNumberLineModel(input, ruleId);
  return (
    <AnimatedNumberLine
      key={`${input.a.toString()}:${input.b.toString()}:${ruleId}`}
      label={translateKnownText(locale, label)}
      model={model}
      ruleId={ruleId}
    />
  );
}
