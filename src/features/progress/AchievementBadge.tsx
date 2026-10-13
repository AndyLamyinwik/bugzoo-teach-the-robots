import type { RobotKind } from '../../components/RobotPortrait';

/** Original SVG marks accompany, and never replace, the completion description. */
export function AchievementBadge({ kind }: { readonly kind: RobotKind }) {
  const colors: Record<RobotKind, string> = {
    fox: '#b96432',
    panda: '#527b59',
    mole: '#7f62a0',
    crow: '#417b9a',
  };
  return (
    <svg
      className="progress-achievement-mark"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 104 116"
      width="104"
      height="116"
    >
      <path
        d="m26 76-5 34 25-12 6 10 6-10 25 12-5-34"
        fill="#e5eacb"
        stroke="#839461"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m52 6 11 7 13 1 7 11 11 7-1 14 5 12-8 11-4 13-14 3-10 9-13-5-13 1-8-11-12-6 1-14-5-12 9-10 4-13 13-3Z"
        fill="#fffdf5"
        stroke={colors[kind]}
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <circle cx="52" cy="50" r="29" fill={colors[kind]} opacity="0.12" />
      <g
        fill="none"
        stroke={colors[kind]}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      >
        {kind === 'fox' && (
          <>
            <path d="M31 50h15m12 0h15M37 37h3m-3 25h3m26-25h3m-3 25h3M49 43h6m-3-3v6" />
            <path d="m34 78 5 5 9-10" />
          </>
        )}
        {kind === 'panda' && (
          <>
            <circle cx="37" cy="35" r="6" />
            <circle cx="67" cy="65" r="6" />
            <path d="m38 66 27-32M26 81h52m-8-6 8 6-8 6" />
          </>
        )}
        {kind === 'mole' && (
          <>
            <path d="M27 57h50m-8-8 8 8-8 8M35 53v8m17-8v8m17-8v8M35 39h35m-6-6 6 6-6 6" />
            <circle cx="35" cy="57" r="4" fill={colors[kind]} />
          </>
        )}
        {kind === 'crow' && (
          <>
            <circle cx="40" cy="39" r="7" />
            <circle cx="65" cy="61" r="7" />
            <path d="m50 42 15 4-4 4M29 70h18m-4-4 4 4-4 4" />
            <path d="M49 31h24v13" strokeDasharray="3 5" />
          </>
        )}
      </g>
    </svg>
  );
}
