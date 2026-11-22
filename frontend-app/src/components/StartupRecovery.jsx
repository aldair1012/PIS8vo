import PlatformLogo from '../templates/Common/PlatformLogo';

export default function StartupRecovery({ title, children, action, onRetry, light }) {
  return (
    <main className={`zeasys-home startup-recovery zeasys-home--${light ? 'light' : 'dark'}`}>
      <section role="alert">
        <PlatformLogo variant="wordmark" size={30} />
        <h1>{title}</h1>
        <p>{children}</p>
        <button type="button" onClick={onRetry}>{action}</button>
        <a href="mailto:zeasys123@gmail.com">Contactar con soporte</a>
      </section>
    </main>
  );
}
