import { useState } from 'react';
import precios from '../../../backend-api/data/referencias/precios-maiz-provincia.json';

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const moneda = n => n.toLocaleString('es-EC', { style:'currency', currency:'USD' });

export default function PreciosProvincia({ provinciaParcela, preview, aplicar }) {
  const provincias = Object.keys(precios.series);
  const inicial = provincias.find(p => normalizar(p) === normalizar(provinciaParcela)) ?? '';
  const [provincia, setProvincia] = useState(inicial);
  const [fecha, setFecha] = useState('');
  const serie = precios.series[provincia] ?? {};
  const meses = Object.keys(serie).sort().reverse();
  const mes = fecha || meses[0] || '';
  const precio = serie[mes];
  return <section className="field-evidence"><h2>Si cambia el precio de venta</h2>
    <p>Estimación, no oferta de compra. Los tres escenarios conservan tu rendimiento y tus costos por hectárea.</p>
    <div className="price-scenarios">{[['Bajo',0.9],['Medio',1],['Alto',1.1]].map(([nombre,factor]) => {
      const valor = preview.priceQq == null ? null : Math.round(preview.priceQq*factor*100)/100;
      return <div key={nombre}><strong>{nombre} · {Math.round(100*factor)} % del precio base</strong><p>{valor == null ? 'Falta precio' : moneda(valor) + '/qq'}</p>
        <span>{valor == null || preview.yieldQq == null || preview.costPerHa == null ? 'Completa el presupuesto para ver el margen.' : 'Margen ' + moneda(preview.yieldQq*valor-preview.costPerHa) + '/ha'}</span></div>;
    })}</div>
    <details><summary>Precios mensuales al productor por provincia · MAGP/SIPA</summary>
      <p>Maíz duro seco estandarizado al 13 % de humedad y 1 % de impurezas. USD por 100 libras. Edición de {precios.edicion.toLowerCase()}. Los meses disponibles corresponden a observaciones publicadas.</p>
      <label>Provincia de la serie <select value={provincia} onChange={e => {setProvincia(e.target.value); setFecha('');}}><option value="">Elige una provincia</option>{provincias.map(p => <option key={p}>{p}</option>)}</select></label>{provincia && <>
        <label>Mes observado <select value={mes} onChange={e=>setFecha(e.target.value)}>{meses.map(m=><option key={m}>{m}</option>)}</select></label>
        <p>{mes} · {moneda(precio)}/qq</p><button type="button" className="btn btn-secondary" onClick={()=>aplicar(precio)}>Usar este precio en el presupuesto</button></>}
      <p><a href={precios.fuente}>Descargar serie oficial del MAGP</a></p></details></section>;
}
