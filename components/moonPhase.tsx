import React from 'react';

// --- Define the specific allowed phase types --- 
export type MoonPhaseType = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent';

interface MoonPhaseIconProps {
  phase: MoonPhaseType; // Use the specific type here
  size?: number;
  color?: string;
}

const MoonPhaseIcon: React.FC<MoonPhaseIconProps> = ({ 
  phase, 
  size = 24, 
  color = '#FFF'
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {getMoonPhase(phase, color)}
    </svg>
  );
};

const getMoonPhase = (phase: MoonPhaseType, color: string) => {
  const phases = {
    new: (
      <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="2" />
    ),
    waxingCrescent: (
      <path
        d="M12 2a10 10 0 0 1 0 20 10 10 0 1 0 0-20z"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
    firstQuarter: (
      <path
        d="M12 2a10 10 0 0 1 0 20V2z"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
    waxingGibbous: (
      <path
        d="M12 2a10 10 0 0 1 0 20 10 10 0 0 0 0-20z"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
    full: (
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
    waningGibbous: (
      <path
        d="M12 2a10 10 0 0 0 0 20 10 10 0 0 1 0-20z"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
    lastQuarter: (
      <path
        d="M12 2a10 10 0 0 0 0 20V2z"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
    waningCrescent: (
      <path
        d="M12 2a10 10 0 1 1 0 20 10 10 0 0 0 0-20z"
        fill={color}
        stroke="currentColor"
        strokeWidth="2"
      />
    ),
  };

  return phases[phase] || phases.new;
};

export default MoonPhaseIcon;
