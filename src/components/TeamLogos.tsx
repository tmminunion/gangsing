import React from 'react';

interface LogoProps {
  className?: string;
}

export function ArsenalLogo({ className = "w-10 h-10" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Glossy Red Outer Shield */}
      <path 
        d="M50 5 L88 20 C88 55 70 85 50 95 C30 85 12 55 12 20 L50 5 Z" 
        fill="#EF4444" 
        stroke="#FFFFFF" 
        strokeWidth="4" 
        filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.4))"
      />
      {/* Sleek Golden Inner Accent Border */}
      <path 
        d="M50 11 L82 23 C82 51 66 77 50 86 C34 77 18 51 18 23 L50 11 Z" 
        fill="none" 
        stroke="#F59E0B" 
        strokeWidth="2.5" 
      />
      {/* Cyber Cannon Spawns */}
      <circle cx="50" cy="56" r="11" fill="#1E293B" stroke="#FFFFFF" strokeWidth="3.5" />
      <circle cx="50" cy="56" r="4.5" fill="#F59E0B" />
      
      {/* Carriage Support Leg */}
      <path d="M32 66 L47 56" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
      
      {/* Futuristic Cannon Barrel pointing East (Right) */}
      <path 
        d="M34 46 L68 46 L68 41 L73 41 L73 35 L68 35 L68 30 L34 30 Z" 
        fill="#FFFFFF" 
        stroke="#0F172A" 
        strokeWidth="2.5" 
      />
      {/* Cannon details */}
      <rect x="71" y="33" width="5" height="10" rx="1" fill="#F59E0B" />
      <rect x="30" y="32" width="5" height="12" rx="1.5" fill="#F59E0B" />
    </svg>
  );
}

export function PSGLogo({ className = "w-10 h-10" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Deep Cyber Blue Circular Shield */}
      <circle 
        cx="50" 
        cy="50" 
        r="44" 
        fill="#1E3A8A" 
        stroke="#FFFFFF" 
        strokeWidth="4" 
        filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.4))"
      />
      <circle cx="50" cy="50" r="38" fill="#0F172A" stroke="#EF4444" strokeWidth="3" />
      
      {/* Eiffel Tower Silhouette in PSG Crimson Red */}
      <path 
        d="M34 78 C34 68 43 58 47 52 L53 52 C57 58 66 68 66 78" 
        stroke="#EF4444" 
        strokeWidth="6" 
        strokeLinecap="round" 
      />
      {/* Platform */}
      <rect x="41" y="50" width="18" height="4.5" rx="1" fill="#FFFFFF" />
      
      {/* Spire and Dome */}
      <path d="M47 50 L47 21 L53 21 L53 50 Z" fill="#EF4444" />
      <path d="M50 21 L50 10" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      
      {/* Bottom Archway cutout */}
      <path d="M43 78 C43 69 57 69 57 78" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
      
      {/* Neon White Segment Dash */}
      <circle cx="50" cy="50" r="41" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="4 4" />
    </svg>
  );
}
