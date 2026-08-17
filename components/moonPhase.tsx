import React from 'react';

// --- Define the specific allowed phase types ---
export type MoonPhaseType = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent';

interface MoonPhaseIconProps {
  phase: MoonPhaseType; // Use the specific type here
  size?: number;
}

// The lit portion is filled black and the unlit portion stays white: on a white
// e-ink panel that is the only pairing where full and new read differently.
const LIT_FILL = 'var(--inky-black)';
const UNLIT_FILL = 'var(--inky-white)';

// Right-hand limb (waxing) is `A10 10 0 0 1`, left-hand limb (waning) is
// `A10 10 0 0 0`. The terminator is a half-ellipse whose rx shrinks toward the
// quarters; a sweep away from the limb gives a crescent, toward it a gibbous.
const LIT_PATHS: Record<Exclude<MoonPhaseType, 'new' | 'full'>, string> = {
  waxingCrescent: 'M12 2 A10 10 0 0 1 12 22 A5 10 0 0 0 12 2 Z',
  firstQuarter: 'M12 2 A10 10 0 0 1 12 22 Z',
  waxingGibbous: 'M12 2 A10 10 0 0 1 12 22 A5 10 0 0 1 12 2 Z',
  waningGibbous: 'M12 2 A10 10 0 0 0 12 22 A5 10 0 0 0 12 2 Z',
  lastQuarter: 'M12 2 A10 10 0 0 0 12 22 Z',
  waningCrescent: 'M12 2 A10 10 0 0 0 12 22 A5 10 0 0 1 12 2 Z',
};

const MoonPhaseIcon: React.FC<MoonPhaseIconProps> = ({ phase, size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Full disc outline, so the unlit portion still reads as a moon. */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={phase === 'full' ? LIT_FILL : UNLIT_FILL}
        stroke={LIT_FILL}
        strokeWidth="2"
      />
      {phase !== 'new' && phase !== 'full' && (
        <path d={LIT_PATHS[phase]} fill={LIT_FILL} stroke="none" />
      )}
    </svg>
  );
};

export default MoonPhaseIcon;
