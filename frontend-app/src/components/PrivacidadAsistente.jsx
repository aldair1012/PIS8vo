import { useEffect, useState } from 'react';
import { chatService } from '../services/api';

export function AvisoAsistente() {
  return <p>El asistente envía a Gemini tu pregunta, historial reciente y contexto de la parcela, que puede incluir ubicación, mediciones y simulaciones. Puede consultar fuentes con Google. Puedes retirar la autorización en Configuración. <a href="./privacidad.html" target="_blank" rel="noreferrer">Política de datos personales</a></p>;
}

export default function PrivacidadAsistente() {
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    chatService.consentimiento().then(data => { if (vigente) setEstado(data); })
      .catch(() => { if (vigente) setError('No se pudo consultar tu autorización.'); });
    return () => { vigente = false; };
  }, [intento]);
  const cambiar = async () => {
    setError('');
    if (!estado) { setIntento(value => value + 1); return; }
    setOcupado(true);
    try { setEstado(await chatService.decidirConsentimiento(!estado.autorizado, estado.version)); }
    catch { setError('No se pudo guardar tu decisión. Vuelve a intentarlo.'); }
    finally { setOcupado(false); }
  };
  return <section className="settings-card" aria-labelledby="settings-privacidad">
    <h2 id="settings-privacidad">Privacidad del asistente</h2><AvisoAsistente />
    {estado && <p role="status">{estado.autorizado ? 'Autorizaste el uso del asistente.' : 'El asistente no tiene autorización.'}</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="settings-button" disabled={ocupado || (!estado && !error)} onClick={cambiar}>
      {estado ? (estado.autorizado ? 'Retirar autorización' : 'Autorizar el uso del asistente') : 'Consultar autorización'}
    </button>
  </section>;
}
