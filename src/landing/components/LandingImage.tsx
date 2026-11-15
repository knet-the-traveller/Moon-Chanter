import React from 'react';
import { IMAGE_SLOTS } from '../config/images';
import type { ImageSlotConfig } from '../types';

interface LandingImageProps {
  slot: ImageSlotConfig['id'];
  src?: string;
  alt: string;
  credit?: string;
  className?: string;
  priority?: boolean;
}

export const LandingImage: React.FC<LandingImageProps> = ({
  slot,
  src,
  alt,
  credit,
  className = '',
  priority = false
}) => {
  const config = IMAGE_SLOTS[slot];
  const isDev = process.env.NODE_ENV === 'development';

  if (src) {
    return (
      <figure className={`relative overflow-hidden rounded-2xl ${className}`}>
        <img
          src={src}
          alt={alt}
          width={config.width}
          height={config.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="w-full h-full object-cover"
        />
        {credit && (
          <figcaption className="sr-only">
            {credit}
          </figcaption>
        )}
      </figure>
    );
  }

  // Graceful fallback with design gradients
  return (
    <div
      className={`relative overflow-hidden rounded-2xl flex items-center justify-center ${className}`}
      style={{
        background: config.defaultGradient,
        aspectRatio: `${config.width} / ${config.height}`
      }}
      role="img"
      aria-label={alt}
    >
      {/* Decorative contour overlay lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,20 Q30,10 60,35 T100,25" fill="none" stroke="#ffffff" strokeWidth="0.8" />
        <path d="M0,45 Q40,30 70,60 T100,50" fill="none" stroke="#ffffff" strokeWidth="0.8" />
        <path d="M0,70 Q25,60 55,85 T100,75" fill="none" stroke="#ffffff" strokeWidth="0.8" />
      </svg>

      {/* Show development slot placeholder label only in dev mode */}
      {isDev && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/40 backdrop-blur-md text-[10px] font-mono tracking-wider text-white border border-white/20 select-none">
          ⛶ {config.devLabel}
        </div>
      )}
    </div>
  );
};
