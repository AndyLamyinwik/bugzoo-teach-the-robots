import { useI18n, translateKnownText } from '../../i18n';
import { RobotPortrait } from '../../components/RobotPortrait';
import { lessonLinks } from '../../app/routes';
import { robotIntroductions } from '../../content/robots';
import { createRational } from '../../domain/math/rational';
import type { Rational } from '../../domain/math/rational';

const exampleFractions = {
  left: createRational(1n, 2n),
  right: createRational(1n, 3n),
  misconception: createRational(2n, 5n),
  correct: createRational(5n, 6n),
};

function Fraction({ value }: { readonly value: Rational }) {
  return (
    <span className="fraction" aria-hidden="true">
      <span>{value.numerator.toString()}</span>
      <span>{value.denominator.toString()}</span>
    </span>
  );
}

function FractionIllustration() {
  const { t } = useI18n();

  return (
    <figure className="notebook" aria-labelledby="notebook-caption">
      <div className="notebook-topline">
        <span className="notebook-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{t('一個小錯誤，一個新發現')}</span>
        <span className="example-label">{t('概念示意')}</span>
      </div>
      <div className="notebook-student">
        <RobotPortrait kind="fox" className="notebook-portrait" />
        <div>
          <p className="notebook-name" lang="en">
            FractionFox
          </p>
          <p className="notebook-thought">{t('「我把上面和下面都加起來了！」')}</p>
        </div>
      </div>
      <div className="wrong-equation">
        <span className="sr-only">
          {t('錯誤示例：二分之一加三分之一，等於五分之二。')}
        </span>
        <div className="equation" aria-hidden="true">
          <Fraction value={exampleFractions.left} />
          <span>+</span>
          <Fraction value={exampleFractions.right} />
          <span>=</span>
          <span className="wrong-answer">
            <Fraction value={exampleFractions.misconception} />
          </span>
        </div>
        <span className="wrong-note">{t('咦，這樣對嗎？')}</span>
      </div>
      <div className="teacher-note">
        <span className="note-marker" aria-hidden="true">
          ?
        </span>
        <div>
          <p>{t('如果分母代表每一份的大小……')}</p>
          <p>{t('大小不同的兩份，可以直接相加嗎？')}</p>
        </div>
      </div>
      <div className="correct-example">
        <div>
          <span className="small-label">{t('換成同樣大小的單位')}</span>
          <p>{t('先通分，再相加。')}</p>
        </div>
        <span className="sr-only">
          {t('正確示例：二分之一加三分之一，等於六分之五。')}
        </span>
        <div className="equation equation-small" aria-hidden="true">
          <Fraction value={exampleFractions.left} />
          <span>+</span>
          <Fraction value={exampleFractions.right} />
          <span>=</span>
          <Fraction value={exampleFractions.correct} />
        </div>
      </div>
      <figcaption id="notebook-caption">
        {t('玩法示意 · FractionFox 互動課程已開放')}
      </figcaption>
    </figure>
  );
}

export function HomePage() {
  const { t, locale } = useI18n();

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('跳到主要內容')}
      </a>
      <header className="site-header page-width">
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            width="38"
            height="38"
            alt=""
          />
          <span lang="en">
            BugZoo<span className="brand-dot">.</span>
          </span>
        </div>
        <p className="header-note">{t('一間由你來教的機器人學校')}</p>
        <span className="header-badge">
          <span aria-hidden="true" />
          {t('好奇心，歡迎入場')}
        </span>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="hero page-width" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow" lang="en">
              <span aria-hidden="true">✳</span> Teach the Wrong Robots
            </p>
            <h1 id="hero-title">
              {t('這次，換你')}
              <br />
              {t('教')}
              <span className="headline-highlight">{t('機器人')}</span>
              {t('。')}
            </h1>
            <p className="hero-description">
              {t('牠們很有自信，卻常常想錯。')}
              <br />
              {t('觀察推理、設計反例、提供正確示例。')}
              <br className="desktop-break" />
              {t('當你教懂牠們，也會更懂自己學會了什麼。')}
            </p>
            <div className="hero-principle">
              <span className="principle-icon" aria-hidden="true">
                ↗
              </span>
              <p>{t('你是老師。錯誤，是探索的起點。')}</p>
            </div>
            <a className="home-lesson-link" href={lessonLinks.fractionfox}>
              {t('開始教 FractionFox ')}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <FractionIllustration />
        </section>

        <section className="learning-loop page-width" aria-label={t('核心玩法')}>
          <div className="loop-intro">
            <span className="small-label">THE LEARNING LOOP</span>
            <p>
              {t('從「哪裡不對」')}
              <br />
              {t('到「原來如此」。')}
            </p>
          </div>
          <ol className="loop-steps">
            <li>
              <span className="step-number">01</span>
              <div>
                <h2>{t('觀察錯誤')}</h2>
                <p>{t('讀懂機器人的推理，找出可疑之處。')}</p>
              </div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div>
                <h2>{t('設計實驗')}</h2>
                <p>{t('挑一個反例，讓錯誤規則露出破綻。')}</p>
              </div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div>
                <h2>{t('教會牠們')}</h2>
                <p>{t('用正確示例，逐步排除錯誤假設。')}</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="students-section page-width" aria-labelledby="students-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('小小機器人，大大的問號')}</p>
              <h2 id="students-title">{t('認識你的機器人學生')}</h2>
            </div>
            <p className="planned-label">
              <span aria-hidden="true">◌</span>
              {t(' 四個互動課程已開放')}
            </p>
          </div>
          <div className="robot-grid">
            {robotIntroductions.map((robot, index) => (
              <article
                className="robot-card"
                data-kind={robot.kind}
                key={robot.id}
                aria-labelledby={`${robot.id}-title`}
              >
                <div className="robot-card-art">
                  <span className="robot-index">STUDENT / 0{index + 1}</span>
                  <span className="subject-symbol" aria-hidden="true">
                    {robot.symbol}
                  </span>
                  <RobotPortrait kind={robot.kind} className="card-portrait" />
                </div>
                <div className="robot-card-copy">
                  <p className="topic-label">{translateKnownText(locale, robot.topic)}</p>
                  <h3 id={`${robot.id}-title`} lang="en">
                    {robot.name}
                  </h3>
                  <p className="robot-nickname">
                    {translateKnownText(locale, robot.nickname)}
                  </p>
                  <p className="misconception">
                    {translateKnownText(locale, robot.misconception)}
                  </p>
                  <p className="robot-description">
                    {translateKnownText(locale, robot.description)}
                  </p>
                  {robot.id === 'fraction-fox' && (
                    <a className="robot-lesson-link" href={lessonLinks.fractionfox}>
                      {t('進入分數課程 ')}
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                  {robot.id === 'discount-panda' && (
                    <a className="robot-lesson-link" href={lessonLinks.discountpanda}>
                      {t('開始教 DiscountPanda ')}
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                  {robot.id === 'minus-mole' && (
                    <a className="robot-lesson-link" href={lessonLinks.minusmole}>
                      {t('開始教 MinusMole ')}
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                  {robot.id === 'chance-crow' && (
                    <a className="robot-lesson-link" href={lessonLinks.chancecrow}>
                      {t('開始教 ChanceCrow ')}
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="product-note">
            {t(
              '每一步推理都有跡可循。BugZoo 以可解釋的確定性規則，呈現機器人如何修正錯誤。',
            )}
          </p>
        </section>
      </main>

      <footer className="site-footer page-width">
        <span lang="en">BugZoo — Teach the Wrong Robots</span>
        <span>{t('從教會別人，開始真正理解。')}</span>
      </footer>
    </>
  );
}
