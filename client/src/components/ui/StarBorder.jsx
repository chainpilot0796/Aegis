import { useRef, useState } from 'react';

/**
 * StarBorder — animated sweeping glow border.
 * Source: https://reactbits.dev/animations/star-border
 *
 * Adapted for Aegis's white + electric-blue design system:
 *   - Sharp corners (borderRadius: 0) to match the t-btn aesthetic
 *   - Blue glow colour by default
 *   - Only shows the animation on hover / when `active` is true
 *   - Wraps any element type via the `as` prop (default "button")
 *   - All children are rendered inside a transparent inner layer so
 *     the existing .t-btn styles keep full control of appearance.
 */
const StarBorder = ({
  as: Component = 'button',
  className = '',
  color = '#A78BFA',
  speed = '4s',
  thickness = 1,
  active = false,
  children,
  style: styleProp = {},
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);
  const showAnim = hovered || active;

  const containerStyle = {
    display: 'inline-block',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 0,
    padding: `${thickness}px 0`,
    ...styleProp,
  };

  const gradientStyle = {
    background: `radial-gradient(circle, ${color}, transparent 10%)`,
    animationDuration: speed,
  };

  const baseOrb = {
    position: 'absolute',
    width: '300%',
    height: '50%',
    opacity: showAnim ? 0.7 : 0,
    borderRadius: '50%',
    transition: 'opacity 0.2s ease',
    zIndex: 0,
    pointerEvents: 'none',
  };

  return (
    <Component
      className={`star-border-container ${className}`}
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
    >
      {/* bottom sweeping orb */}
      <div
        style={{
          ...baseOrb,
          bottom: '-12px',
          right: '-250%',
          ...gradientStyle,
          ...(showAnim
            ? { animation: `star-movement-bottom ${speed} linear infinite alternate` }
            : {}),
        }}
      />
      {/* top sweeping orb */}
      <div
        style={{
          ...baseOrb,
          top: '-12px',
          left: '-250%',
          ...gradientStyle,
          ...(showAnim
            ? { animation: `star-movement-top ${speed} linear infinite alternate` }
            : {}),
        }}
      />
      {/* inner: no background/border — let the caller's className own those */}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </Component>
  );
};

export default StarBorder;
