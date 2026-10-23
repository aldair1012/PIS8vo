import logoFullUrl from '../../assets/logo-full.svg';
import logoIconUrl from '../../assets/logo-icon.svg';
import zeasysMarkUrl from '../../assets/zeasys-mark.svg';

/**
 * Shared ZeaSys brand component.
 *
 * `legacy` keeps the original artwork used by the authenticated application.
 * `mark` is the compact data-and-leaf symbol for small surfaces.
 * `wordmark` is the adaptive lockup used by the public homepage; the name is
 * rendered once inside this component so callers cannot accidentally repeat it.
 */
export default function PlatformLogo({ size = 48, isIconOnly = false, variant = 'legacy', className = '', style = {} }) {
  const isWordmark = variant === 'wordmark';
  const isMark = variant === 'mark';
  const useCompactMark = isMark || isIconOnly;
  const height = isWordmark ? size : size * 1.15;
  const width = isWordmark ? size * 4.35 : useCompactMark ? height * 0.88 : height * 1.72;
  const imageSource = isMark || isWordmark ? zeasysMarkUrl : (isIconOnly ? logoIconUrl : logoFullUrl);

  return (
    <div
      className={`platform-logo ${isWordmark ? 'platform-logo--wordmark' : ''} ${isMark ? 'platform-logo--mark' : ''} ${className}`}
      style={{
        width,
        height,
        overflow: 'visible',
        position: 'relative',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isWordmark ? 'flex-start' : 'center',
        gap: isWordmark ? size * 0.28 : 0,
        ...style,
      }}
    >
      <img
        src={isWordmark ? zeasysMarkUrl : imageSource}
        alt={isWordmark ? '' : 'ZeaSys'}
        aria-hidden={isWordmark ? 'true' : undefined}
        className="platform-logo-img"
        loading="lazy"
        decoding="async"
        style={{
          height: isWordmark ? '100%' : '100%',
          width: 'auto',
          aspectRatio: '1 / 1',
          display: 'block',
          maxWidth: 'none',
        }}
      />
      {isWordmark && <span className="platform-logo-wordmark">ZeaSys</span>}
    </div>
  );
}
