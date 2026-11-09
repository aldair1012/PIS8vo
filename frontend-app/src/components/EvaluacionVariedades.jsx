import { useId, useRef, useState } from 'react';
import { Sprout, ExternalLink } from 'lucide-react';
import { simulacionService } from '../services/api';
import { parseSimulationNumber } from '../utils/simulationInput';
import '../assets/variedades.css';

const estados = {
  coincide: 'Coincidencia publicada', documentado: 'Uso documentado',
  fuera_referencia: 'Fuera del intervalo publicado', sin_dato_parcela: 'Falta el dato de la parcela',
  sin_referencia_provincial: 'Sin referencia para esta provincia', sin_referencia: 'Sin información específica',
  referencia_general_coincide: 'Dentro de la guía general', fuera_guia_general: 'Fuera de la guía general',
};

function FichaVariedad({ ficha, sinTitulo = false }) {
  const fuentes = [...new Map(ficha.fuentes.map((fuente) => [`${fuente.id}-${fuente.pagina_pdf ?? ''}`, fuente])).values()];
  return <article className="variedad-ficha" aria-label={ficha.nombre}>
    {!sinTitulo && <h4>{ficha.nombre}</h4>}
    <p>{ficha.tipo_grano_documentado}</p>
    {ficha.categorias_consumo?.length > 0 && <p>Consumo o destino documentado: {ficha.categorias_consumo.join(', ')}.</p>}
    <dl className="variedad-criterios">{ficha.criterios.map((criterio) => <div key={criterio.criterio}>
      <dt>{criterio.criterio}</dt>
      <dd><strong>{estados[criterio.estado] ?? 'Pendiente de revisión'}</strong><span>{criterio.detalle}</span></dd>
    </div>)}</dl>
    {ficha.cosecha_orientativa_dias !== null && <p>Cosecha orientativa publicada: <strong>{ficha.cosecha_orientativa_dias} días</strong> para el uso consultado. El clima y el manejo pueden cambiar esa duración.</p>}
    <p className="variedad-soporte">{ficha.soporte_modelo.nota}</p>
    <details className="variedad-fuentes">
      <summary>Fuentes y requisitos publicados</summary>
      {ficha.manejo_referencial.map((guia, index) => <p key={index}>
        {guia.concepto === 'densidad_plantas_ha'
          ? `Densidad de referencia: ${guia.valor.toLocaleString('es-EC')} plantas/ha.`
          : `Fertilización de referencia: ${Object.entries(guia.valor).map(([nutriente, dosis]) => `${dosis} kg ${nutriente}/ha`).join(', ')}.`}
        {' '}{guia.alcance}
      </p>)}
      {ficha.notas.map((nota, index) => <p key={index}>{nota}</p>)}
      <ul>{fuentes.map((fuente) => <li key={`${fuente.id}-${fuente.pagina_pdf ?? ''}`}>
        <a href={`${fuente.url}${fuente.pagina_pdf ? `#page=${fuente.pagina_pdf}` : ''}`} target="_blank" rel="noopener noreferrer">
          {fuente.titulo}{fuente.pagina_pdf ? ` · página PDF ${fuente.pagina_pdf}` : ''}<ExternalLink size={13} aria-hidden="true" />
        </a>{fuente.alcance && <span>{fuente.alcance}</span>}
      </li>)}</ul>
    </details>
  </article>;
}

export default function EvaluacionVariedades({ cultivoId, ph, disabled = false }) {
  const id = useId();
  const request = useRef(0);
  const [objetivo, setObjetivo] = useState('grano_seco');
  const [consulta, setConsulta] = useState(null);
  const [loading, setLoading] = useState(false);
  const phValue = parseSimulationNumber(ph);
  const phInvalido = String(ph ?? '').trim() !== '' && (phValue === null || phValue < 3 || phValue > 11);
  const key = `${cultivoId}|${objetivo}|${phValue}`;
  const vigente = consulta?.key === key ? consulta : null;

  const consultar = async () => {
    const sequence = ++request.current;
    setLoading(true);
    try {
      const response = await simulacionService.evaluarVariedades({ cultivo_id: Number(cultivoId), objetivo, ph_suelo: phValue });
      if (!response.exito || !response.evaluacion) throw new Error('Respuesta de evaluación incompleta');
      if (sequence === request.current) setConsulta({ key, resultado: response.evaluacion });
    } catch (error) {
      if (sequence === request.current) setConsulta({ key, error: error.response?.data?.error || 'No se pudieron consultar las fichas. Inténtalo de nuevo.' });
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  };

  if (!cultivoId) return null;
  const resultado = vigente?.resultado;
  return <details className="glass-panel variedades-panel">
    <summary><Sprout size={19} aria-hidden="true" /><span>¿Tu variedad corresponde a esta zona?</span></summary>
    <div className="variedades-contenido">
      <p>Esta consulta opcional te ayuda a conocer los requisitos publicados de tu semilla y a explorar alternativas para otra siembra. No cambia la variedad de tu parcela ni calcula cuál producirá más.</p>
      <div className="variedades-controles">
        <div><label htmlFor={id}>¿Qué quieres cosechar?</label>
          <select id={id} className="form-select" value={objetivo} onChange={(event) => setObjetivo(event.target.value)} disabled={loading || disabled}>
            <option value="grano_seco">Grano seco</option><option value="choclo">Choclo</option>
            <option value="forraje">Forraje</option><option value="tostado">Tostado / chulpi</option><option value="canguil">Canguil</option>
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={consultar} disabled={loading || disabled || phInvalido}>
          {loading ? 'Consultando…' : 'Revisar adaptación'}
        </button>
      </div>
      {phInvalido && <p>Revisa el pH del formulario antes de consultar las fichas: utiliza un valor entre 3 y 11.</p>}
      {consulta && !vigente && !loading && <p role="status">Los datos cambiaron. Revisa otra vez la adaptación para actualizar la consulta.</p>}
      {vigente?.error && <p role="alert">{vigente.error}</p>}
      {resultado && <div aria-live="polite">
        {resultado.actual?.nombre !== resultado.variedad_registrada && <p>Nombre guardado en la parcela: <strong>{resultado.variedad_registrada || 'Sin nombre registrado'}</strong>.</p>}
        {resultado.contexto.altitud_registrada_m === null && <p>Falta la altitud registrada de la parcela. Puedes completarla en Mis parcelas para comparar los intervalos de las fichas.</p>}
        {resultado.actual ? <FichaVariedad ficha={resultado.actual} /> : <p>No hay una ficha específica para este nombre. Puedes conservar tu variedad local; todavía falta documentar sus condiciones de adaptación.</p>}
        <h3 className="variedades-subtitulo">Otras variedades con coincidencias documentadas</h3>
        <p>Del mismo grupo de maíz registrado. El orden refleja coincidencias con las referencias consultadas, sin comparar rendimientos.</p>
        {resultado.alternativas.length > 0 ? resultado.alternativas.map((ficha) => <details className="variedad-alternativa" key={ficha.id}>
          <summary>{ficha.nombre}</summary><FichaVariedad ficha={ficha} sinTitulo />
        </details>) : <p>No hay coincidencias suficientes para sugerir otra variedad con estos datos y este uso. Esto no demuestra que las demás sean inadecuadas.</p>}
        <p className="variedad-soporte">{resultado.materiales_catalogados} materiales en el catálogo. {resultado.criterio_catalogo} Los requisitos sin respaldo permanecen sin dato. Estas referencias no son mediciones de tu parcela.</p>
        {objetivo !== 'grano_seco' && <p>Esta consulta revisa el uso elegido. El cálculo de rendimiento de la simulación actual sigue siendo de grano; no estima toneladas de choclo ni de forraje.</p>}
      </div>}
    </div>
  </details>;
}
