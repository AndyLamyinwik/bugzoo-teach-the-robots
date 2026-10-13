export type RobotKind = 'fox' | 'panda' | 'mole' | 'crow';

interface RobotPortraitProps {
  kind: RobotKind;
  className?: string;
}

const palette: Record<RobotKind, { body: string; background: string }> = {
  fox: { body: '#c76b37', background: '#f8e8d7' },
  panda: { body: '#66866b', background: '#e9efe4' },
  mole: { body: '#8673ab', background: '#eeebf5' },
  crow: { body: '#537f9d', background: '#e5eff3' },
};

/** Original decorative robot illustrations; names and descriptions live in the UI. */
export function RobotPortrait({ kind, className }: RobotPortraitProps) {
  const colors = palette[kind];

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height="160"
      viewBox="0 0 160 160"
      width="160"
    >
      <circle cx="80" cy="80" fill={colors.background} r="76" />
      <path
        d="M29 125h15m76 0h11M23 111h7m100 0h7"
        fill="none"
        stroke={colors.body}
        strokeLinecap="round"
        strokeWidth="3"
      />
      <g stroke="#183c35" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
        <path d="M80 38V24" fill="none" />
        <circle cx="80" cy="19" fill="#e3b650" r="5" />

        {kind === 'fox' && (
          <>
            <path
              d="M36 72 31 36l34 16h30l34-16-5 36 9 23-23 34H50L27 95Z"
              fill={colors.body}
            />
            <path d="m40 51 4 18 15-10m61-8-4 18-15-10" fill="#f1b482" />
            <path d="m35 96 21 6 24 17 24-17 21-6-15 33H50Z" fill="#fff8e9" />
            <rect fill="#fff8e9" height="17" rx="4" width="25" x="46" y="77" />
            <rect fill="#fff8e9" height="17" rx="4" width="25" x="89" y="77" />
            <path d="m73 107 7 7 7-7Z" fill="#183c35" />
            <path d="M80 115v6m-7 1h14" fill="none" />
          </>
        )}

        {kind === 'panda' && (
          <>
            <circle cx="42" cy="51" fill={colors.body} r="17" />
            <circle cx="118" cy="51" fill={colors.body} r="17" />
            <path d="M40 57Q80 35 120 57l10 37q0 36-50 38-50-2-50-38Z" fill="#fff8e9" />
            <rect fill={colors.body} height="36" rx="13" width="33" x="39" y="70" />
            <rect fill={colors.body} height="36" rx="13" width="33" x="88" y="70" />
            <rect fill="#fff8e9" height="15" rx="3" width="21" x="46" y="79" />
            <rect fill="#fff8e9" height="15" rx="3" width="21" x="93" y="79" />
            <path d="m73 108 7 6 7-6Z" fill="#183c35" />
            <path d="M72 120q8 7 16 0" fill="none" />
          </>
        )}

        {kind === 'mole' && (
          <>
            <circle cx="40" cy="86" fill={colors.body} r="11" />
            <circle cx="120" cy="86" fill={colors.body} r="11" />
            <path d="M34 97q0-53 46-53t46 53v15q-9 20-46 20t-46-20Z" fill={colors.body} />
            <path d="M58 48v12m44-12v12" fill="none" stroke="#c3b6d7" />
            <rect fill="#fff8e9" height="17" rx="4" width="24" x="46" y="76" />
            <rect fill="#fff8e9" height="17" rx="4" width="24" x="90" y="76" />
            <path d="M58 111q0-15 22-15t22 15q-4 15-22 15t-22-15Z" fill="#d5bfd5" />
            <ellipse cx="80" cy="105" fill="#183c35" rx="9" ry="6" />
            <path d="M80 113v6m-6 1h12" fill="none" />
            <path d="M43 104h8m58 0h8" fill="none" />
          </>
        )}

        {kind === 'crow' && (
          <>
            <path
              d="m47 61 13-19 12 10 16-14 9 15 14-7 11 26 5 40q-10 20-47 20t-47-20l5-40Z"
              fill={colors.body}
            />
            <path d="m38 95-9 17 18 5m75-22 9 17-18 5" fill={colors.body} />
            <rect fill="#fff8e9" height="17" rx="4" width="24" x="46" y="74" />
            <rect fill="#fff8e9" height="17" rx="4" width="24" x="90" y="74" />
            <path d="m80 95-17 15 17 15 17-15Z" fill="#e3b650" />
            <path d="M64 110h32" fill="none" />
            <path d="m47 64 10-5m56 5-10-5" fill="none" stroke="#a9c7d5" />
          </>
        )}

        <path d="M57 82h5v5h-5Zm41 0h5v5h-5Z" fill="#183c35" stroke="none" />
        <path d="M71 135h18l4 10H67Z" fill="#fff8e9" />
        <path d="M77 140h6" fill="none" stroke={colors.body} />
      </g>
    </svg>
  );
}
