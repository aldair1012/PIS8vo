import { useState } from 'react';
import referencia from '../../../backend-api/data/referencias/planificacion-mensual-espac.json';
import contraste from '../../../backend-api/data/referencias/contraste-ediciones-espac.json';

const fmt = (n) => n.toLocaleString('es-EC', { maximumFractionDigits: 2 });
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export default function ReferenciaMensualEspac({ provincia, fechas }) {
  const [producto, setProducto] = useState('');
  const locales = referencia.celdas.filter(c => normalizar(c.provincia) === normalizar(provincia) && c.tipo_maiz === producto);
  const maximo = Math.max(1, ...locales.map(c => c.mediana + referencia.bandas[1].margen));
  return <section className="field-evidence"><h3>Rendimiento histórico por mes de siembra</h3>
    <p>ESPAC 2025 · {provincia || 'Provincia por identificar'}. Las diferencias entre meses también recogen diferencias de manejo y terreno.</p>
    <label>Producto de la encuesta <select value={producto} onChange={e => setProducto(e.target.value)}><option value="">Elige el grano que vas a cosechar</option><option value="duro_seco">Maíz duro seco</option><option value="suave_seco">Maíz suave seco</option></select></label>
    {producto && <p><strong>Referencia inicial por tipo de grano · {fmt(referencia.base_por_tipo[producto])} t/ha.</strong> Es la mediana ponderada del conjunto de ajuste de 2025. Obtuvo menor error en las dos comparaciones entre ediciones. Para las fechas elegidas se muestran también las medianas locales disponibles.</p>}
    {producto && fechas.map((fecha, i) => {
      if (!fecha) return <p key={i}>Elige la fecha prevista para consultar ese mes.</p>;
      const c = locales.find(fila => fila.mes === Number(fecha?.slice(5, 7)));
      if (!c) return <p key={i}>{fecha || 'Fecha pendiente'} · Sin referencia con cinco segmentos muestrales para esta combinación.</p>;
      return <div key={i}><h4>{fecha} · Mediana {fmt(c.mediana)} t/ha</h4>
        <div className="yield-band-track" aria-hidden="true">{[...referencia.bandas].reverse().map(b => {
          const inicio = Math.max(0, c.mediana - b.margen);
          return <i key={b.nivel} style={{left: inicio/maximo*100+'%', width: (c.mediana+b.margen-inicio)/maximo*100+'%', background: b.nivel === 0.9 ? 'color-mix(in srgb, var(--zs-primary) 30%, transparent)' : 'color-mix(in srgb, var(--zs-primary) 70%, transparent)'}} />;
        })}<b style={{left:c.mediana/maximo*100+'%'}} /></div>
        <p>{referencia.bandas.map(b => `Banda ${100*b.nivel} % de ${fmt(Math.max(0,c.mediana-b.margen))} a ${fmt(c.mediana+b.margen)} t/ha`).join(' · ')}. Referencia de {c.parcelas} registros en {c.segmentos} segmentos.</p></div>;
    })}
    <details><summary>Cómo se calculó y con qué error</summary><p>Mediana ponderada de parcelas de maíz en monocultivo con superficie cosechada positiva. Se separaron los segmentos de ajuste, calibración y prueba. De {referencia.prueba_total} registros reservados, {referencia.prueba} tenían una combinación con datos suficientes. El error absoluto medio en esos casos fue {fmt(referencia.mae)} t/ha.</p>
      <p>Los márgenes se calcularon con {referencia.calibracion} residuos reservados. En la prueba independiente de la misma encuesta, {referencia.bandas.map(b => `la banda de ${b.nivel*100} % incluyó ${b.aciertos_prueba} de ${referencia.prueba} registros (${fmt(100*b.aciertos_prueba/referencia.prueba)} %)`).join(' y ')}. La cobertura puede cambiar en otra campaña. Esta referencia mensual y el simulador de manejo utilizan modelos distintos.</p>
      <h4>Prueba con otra edición de la encuesta</h4>
      {[[contraste.referencia_publicada_2025_en_encuesta_2024,'Referencia de 2025 aplicada a la encuesta de 2024'],
        [contraste.metodo_ajustado_2024_en_siembras_2025,'Método ajustado con 2024 y aplicado a siembras de 2025']].map(([r,titulo]) =>
        <p key={titulo}><strong>{titulo}.</strong> Error absoluto medio {fmt(r.mae_t_ha)} t/ha en {r.evaluados} de {r.elegibles} registros elegibles.
          {' '}Usar únicamente el tipo de grano dio {fmt(r.mae_base_por_tipo_t_ha)} t/ha de error en esos mismos casos.
          {' '}{r.bandas.map(b => `La banda nominal del ${100*b.nivel} % incluyó ${fmt(100*b.incluidas/r.evaluados)} %`).join('. ')}.</p>)}
      <p>Son comparaciones retrospectivas entre encuestas. Las combinaciones de provincia, producto y mes sin referencia suficiente quedaron fuera.</p>
      <a href={contraste.fuente_2024}>Microdatos INEC 2024</a> · <a href={referencia.fuente}>Microdatos INEC 2025</a></details>
  </section>;
}
