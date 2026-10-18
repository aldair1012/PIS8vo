import logoFullUrl from '../../assets/logo-full.svg';
import logoIconUrl from '../../assets/logo-icon.svg';

export default function PlatformLogo({ size = 48, isIconOnly = false, className = '', style = {} }) {
  const height = size * 1.15;
  // Aspect ratios:
  // logo-full.svg tiene viewBox 0 0 1440 835 => relación de aspecto ~1.72
  // logo-icon.svg tiene viewBox 0 100 360 735 => relación de aspecto ~0.49 (figura del choclo)
  const width = isIconOnly ? height * 0.5 : height * 1.72;

  return (
    <div
      className={`platform-logo ${className}`}
      style={{
        width,
        height,
        overflow: 'visible',
        position: 'relative',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={isIconOnly ? logoIconUrl : logoFullUrl}
        alt="ZeaSys"
        className="platform-logo-img"
        loading="lazy"
        decoding="async"
        style={{
          height: '100%',
          width: 'auto',
          display: 'block',
          maxWidth: 'none',
        }}
      />
    </div>
  );
}
