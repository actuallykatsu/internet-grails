import { iconRects, type IconName } from './pixelIcons';

interface Props {
  name: IconName;
  /** Rendered size in CSS pixels. Multiples of 16 stay crispest. */
  size?: number;
  className?: string;
}

/** An original pixel-art icon. Decorative: the label next to it carries the meaning. */
export default function PixelIcon({ name, size = 32, className }: Props) {
  return (
    <svg
      className={className ? `ig-pixel ${className}` : 'ig-pixel'}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {iconRects(name).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
