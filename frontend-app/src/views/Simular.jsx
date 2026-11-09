import { useEffect, useRef, useState } from 'react';
import { MapPin, Pencil, Check, ArrowRight, RefreshCw, Info, Sprout } from 'lucide-react';
import { simulacionService, parcelasService } from '../services/api';
import { parseScenarioNumber, normalizarDecimalEntrada } from '../utils/simulationInput';
import { prepararCamposCultivo, finCultivo, camposCultivo as definicionesCampo } from '../utils/fieldInputs';
import { provinceFromLocation } from '../utils/yieldDashboard';
import { buscarFichaMaiz } from '../data/variedadesMaizEcuador';
import tiposSuelo from '../../../backend-api/data/referencias/tipos-suelo.json' with { type: 'json' };
import EvaluacionVariedades from '../components/EvaluacionVariedades';
import ParametrosCampo from '../components/ParametrosCampo';
import ResultadoSimulacion from '../components/ResultadoSimulacion';
import '../assets/simulacion.css';

const vacios = { area: '', temp: '', hum: '', prec: '', fert: '', ph: '', suelo: '' };
const esNumero = value => ['number','string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value));

const CATALOGO_FERT = [
  { id:'urea', nombre:'Urea', formula:'46-0-0', N:46, P:0, K:0, Mg:0, S:0, precio:33 },
  { id:'dap', nombre:'Fosfato diamónico (DAP)', formula:'18-46-0', N:18, P:46, K:0, Mg:0, S:0, precio:45 },
  { id:'mop', nombre:'Muriato de potasio (MOP)', formula:'0-0-60', N:0, P:0, K:60, Mg:0, S:0, precio:36 },
  { id:'sa', nombre:'Sulfato de amonio', formula:'21-0-0 · 24 S', N:21, P:0, K:0, Mg:0, S:24, precio:29 },
  { id:'na', nombre:'Nitrato de amonio', formula:'33-0-0', N:33, P:0, K:0, Mg:0, S:0, precio:36 },
  { id:'sulpomag', nombre:'Sulpomag (langbeinita)', formula:'0-0-22 · 18 S · 11 Mg', N:0, P:0, K:22, Mg:11, S:18, precio:38 },
  { id:'npk15', nombre:'Mezcla NPK', formula:'15-15-15', N:15, P:15, K:15, Mg:0, S:0, precio:48 },
  { id:'npk12', nombre:'Mezcla NPK', formula:'12-24-12 · 16 S', N:12, P:24, K:16, Mg:0, S:16, precio:52 },
  { id:'npk10', nombre:'Mezcla NPK', formula:'10-30-10', N:10, P:30, K:10, Mg:0, S:0, precio:55 },
  { id:'compost', nombre:'Compost o estiércol', formula:'~1,5-0,5-1,2', N:1.5, P:0.5, K:1.2, Mg:0.3, S:0.4, precio:8 },
];
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '.').replace(/[^\\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const pct = v => Math.min(Math.max(num(v), 0), 100);
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('es');

export default function Simular({ cultivos, onSimulationCompleted, onNavigate, onboardingStep, onNextOnboardingStep, onSimulationContextChange }) {
  const [cultivoId, setCultivoId] = useState('');
  const [datos, setDatos] = useState(vacios);
  const [campos, setCampos] = useState({});
  const [fecha, setFecha] = useState('');
  const [historico, setHistorico] = useState(false);
  const [referencias, setReferencias] = useState(null);
  const [automaticos, setAutomaticos] = useState({});
  const [editarDatos, setEditarDatos] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [result, setResult] = useState(null);
  const [areaResultado, setAreaResultado] = useState(null);
  const [vista, setVista] = useState('preparar');
  const [modoFert, setModoFert] = useState('producto');
  const [seleccionados, setSeleccionados] = useState([]);
  const [inputsFert, setInputsFert] = useState({});
  const [customsFert, setCustomsFert] = useState([]);
  const [aplicacionesN, setAplicacionesN] = useState(2);
  const [formOtroAbierto, setFormOtroAbierto] = useState(false);
  const [formOtro, setFormOtro] = useState({ nombre: '', N: '0', P: '0', K: '0', Mg: '0', S: '0', precio: '0' });
  const modificados = useRef({});
  const headingResultado = useRef(null);
  const tabs = useRef([]);
  const parcela = cultivos.find(c => Number(c.id) === Number(cultivoId));
  const phParcela = parcela?.ph;
  const areaParcela = parcela?.area;
  const ficha = buscarFichaMaiz(parcela?.variedad_maiz);
  const sinModelo = ficha?.simulacion_grano_habilitada === false;
  const provincia = referencias && Object.hasOwn(referencias, 'provincia') ? referencias.provincia : provinceFromLocation(parcela?.ubicacion);
  const fin = finCultivo(fecha, parseScenarioNumber(campos.ciclo_dias));
  const catalogoFert = [...CATALOGO_FERT, ...customsFert];
  const findFert = id => catalogoFert.find(p => p.id === id);
  const totalN = seleccionados.reduce((s, id) => { const r = inputsFert[id]; const p = findFert(id); const kg = r?.unidad === 'kg' ? num(r?.dosis) : num(r?.dosis) * 50; return s + kg * pct(r?.N ?? p?.N ?? 0) / 100; }, 0);
  const totalP = seleccionados.reduce((s, id) => { const r = inputsFert[id]; const p = findFert(id); const kg = r?.unidad === 'kg' ? num(r?.dosis) : num(r?.dosis) * 50; return s + kg * pct(r?.P ?? p?.P ?? 0) / 100; }, 0);
  const totalK = seleccionados.reduce((s, id) => { const r = inputsFert[id]; const p = findFert(id); const kg = r?.unidad === 'kg' ? num(r?.dosis) : num(r?.dosis) * 50; return s + kg * pct(r?.K ?? p?.K ?? 0) / 100; }, 0);
  const totalMg = seleccionados.reduce((s, id) => { const r = inputsFert[id]; const p = findFert(id); const kg = r?.unidad === 'kg' ? num(r?.dosis) : num(r?.dosis) * 50; return s + kg * pct(r?.Mg ?? p?.Mg ?? 0) / 100; }, 0);
  const totalS = seleccionados.reduce((s, id) => { const r = inputsFert[id]; const p = findFert(id); const kg = r?.unidad === 'kg' ? num(r?.dosis) : num(r?.dosis) * 50; return s + kg * pct(r?.S ?? p?.S ?? 0) / 100; }, 0);
  const totalCosto = seleccionados.reduce((s, id) => { const r = inputsFert[id]; const p = findFert(id); const dosis = num(r?.dosis); const precio = num(r?.precio ?? p?.precio); return s + (r?.unidad === 'kg' ? (num(r?.dosis) / 50) * precio : dosis * precio); }, 0);
  const planFertilizacion = seleccionados.map(id => {
    const p = findFert(id); const r = inputsFert[id] || {};
    const dosis = num(r.dosis); const kg = r.unidad === 'kg' ? dosis : dosis * 50;
    return { nombre: p?.nombre, formula: p?.formula, dosis, unidad: r.unidad || 'bolsa', porcentaje: { N: pct(r.N ?? p?.N), P: pct(r.P ?? p?.P), K: pct(r.K ?? p?.K), Mg: pct(r.Mg ?? p?.Mg), S: pct(r.S ?? p?.S) }, aporte: { N: kg * pct(r.N ?? p?.N) / 100, P: kg * pct(r.P ?? p?.P) / 100, K: kg * pct(r.K ?? p?.K) / 100, Mg: kg * pct(r.Mg ?? p?.Mg) / 100, S: kg * pct(r.S ?? p?.S) / 100 }, costo: r.unidad === 'kg' ? (dosis / 50) * num(r.precio ?? p?.precio) : dosis * num(r.precio ?? p?.precio) };
  });

  const invalidar = () => { setResult(null); setAreaResultado(null); setError(null); };
  const cambiarDato = (key, value) => {
    modificados.current[key] = true;
    setDatos(prev => ({ ...prev, [key]: value }));
    invalidar();
  };
  const cambiarCampos = values => {
    setCampos(values); invalidar();
    if (!finCultivo(fecha, parseScenarioNumber(values.ciclo_dias))) setHistorico(false);
  };
  const toggleFert = id => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setInputsFert(prev => {
      if (prev[id]) return prev;
      const p = findFert(id);
      return { ...prev, [id]: { dosis: '1', unidad: 'bolsa', N: String(p?.N ?? 0), P: String(p?.P ?? 0), K: String(p?.K ?? 0), Mg: String(p?.Mg ?? 0), S: String(p?.S ?? 0), precio: String(p?.precio ?? 0) } };
    });
    invalidar();
  };
  const updateInput = (id, field, value) => {
    setInputsFert(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
    invalidar();
  };
  const agregarOtroFert = () => {
    const prod = { id: 'otro-' + Date.now(), nombre: (formOtro.nombre || '').trim() || 'Producto propio', formula: `${formOtro.N}-${formOtro.P}-${formOtro.K}`, N: Number(formOtro.N) || 0, P: Number(formOtro.P) || 0, K: Number(formOtro.K) || 0, Mg: Number(formOtro.Mg) || 0, S: Number(formOtro.S) || 0, precio: Number(formOtro.precio) || 0, propio: true };
    setCustomsFert(prev => [...prev, prod]);
    setSeleccionados(prev => [...prev, prod.id]);
    setInputsFert(prev => ({ ...prev, [prod.id]: { dosis: '1', unidad: 'bolsa', N: formOtro.N, P: formOtro.P, K: formOtro.K, Mg: formOtro.Mg, S: formOtro.S, precio: formOtro.precio } }));
    setFormOtro({ nombre: '', N: '0', P: '0', K: '0', Mg: '0', S: '0', precio: '0' });
    setFormOtroAbierto(false);
    invalidar();
  };
  const seleccionar = id => {
    const crop = cultivos.find(c => Number(c.id) === Number(id));
    modificados.current = {};
    setCultivoId(id); setEditarDatos(false); setReferencias(null); setAviso(''); setAutomaticos({});
    setDatos({ ...vacios, area: esNumero(crop?.area) ? String(crop.area) : '', ph: esNumero(crop?.ph) ? String(crop.ph) : '' });
    setCampos({}); setFecha(crop?.fecha_siembra ?? ''); setHistorico(false); setVista('preparar'); invalidar();
  };

  useEffect(() => {
    let vigente = true;
    if (!cultivoId) return () => { vigente = false; };
    const consultar = async () => {
      setCargandoDatos(true);
      try {
        const response = await parcelasService.obtenerValoresUbicacion(cultivoId);
        if (!vigente) return;
        if (!response.exito) throw new Error('Referencias no disponibles');
        setReferencias(response); setAviso('');
        const propuesta = {};
        for (const [key, field] of Object.entries({ temp: 'temperatura', hum: 'humedad', ph: 'ph_suelo', area: 'area_simulada' })) {
          if (esNumero(response[field])) propuesta[key] = String(response[field]);
        }
        if (Object.hasOwn(tiposSuelo, response.tipo_suelo ?? '')) propuesta.suelo = response.tipo_suelo;
        setDatos(prev => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(propuesta)) if (!modificados.current[key]) next[key] = value;
          return next;
        });
        setAutomaticos(Object.fromEntries(Object.keys(propuesta).map(key => [key, true])));
      } catch {
        if (vigente) setAviso('No se pudieron consultar las referencias externas. Conserva los datos registrados y completa los campos que faltan.');
      } finally { if (vigente) setCargandoDatos(false); }
    };
    consultar();
    return () => { vigente = false; };
  }, [cultivoId, phParcela, areaParcela, recarga]);

  useEffect(() => {
    if (modoFert !== 'producto' || seleccionados.length === 0) return;
    setDatos(prev => ({ ...prev, fert: fmt1(totalN) }));
    setCampos(prev => ({
      ...prev,
      fosforo_p2o5_kg_ha: String(Math.round(totalP * 10) / 10),
      potasio_k2o_kg_ha: String(Math.round(totalK * 10) / 10),
      magnesio_kg_ha: String(Math.round(totalMg * 10) / 10),
      azufre_kg_ha: String(Math.round(totalS * 10) / 10),
      aplicaciones_nitrogeno: String(aplicacionesN),
    }));
  }, [modoFert, seleccionados, inputsFert, totalN, totalP, totalK, totalMg, totalS, aplicacionesN]);

  useEffect(() => {
    onSimulationContextChange?.(parcela ? {
      cultivoId: parcela.id, cultivoActivo: parcela,
      datos: { temperatura: datos.temp, humedad: datos.hum, precipitacion: datos.prec,
        precipitacion_ciclo_mm: datos.prec, periodo_precipitacion: 'mm/ciclo', fertilizante: datos.fert,
        ph_suelo: datos.ph, tipo_suelo: datos.suelo, area_simulada: datos.area,
        parametros_campo: campos, fecha_siembra: fecha, cargando_ubicacion: cargandoDatos },
    } : null);
  }, [parcela, datos, campos, fecha, cargandoDatos, onSimulationContextChange]);

  const simular = async event => {
    event.preventDefault(); setError(null);
    if (!parcela) { setError('Selecciona una parcela para preparar la simulación.'); return; }
    if (sinModelo) { setError('Esta variedad tiene ficha de consulta; su cálculo específico todavía requiere un modelo compatible.'); return; }
    const numbers = {};
    for (const [key, label, min, max] of [
      ['area', 'Área a simular', .01, Number(parcela.area)], ['temp', 'Temperatura media', 0, 50],
      ['hum', 'Humedad relativa', 0, 100], ['prec', 'Lluvia del ciclo', 0, 4000],
      ['fert', 'Nitrógeno aplicado', 0, 500], ['ph', 'pH del suelo', 3, 11],
    ]) {
      const value = parseScenarioNumber(datos[key]);
      if (value === null || value < min || value > max) {
        setError(`${label}: introduce un número entre ${min} y ${max}. No uses separadores de miles: escribe 3500 o, si es un decimal, 3.5.`);
        return;
      }
      numbers[key] = value;
    }
    if (!datos.suelo) { setError('Selecciona la textura del suelo; no hay una estimación disponible para este punto.'); return; }
    if (!campos.riego_tipo) { setError('Indica si el cultivo recibirá solo lluvia o qué sistema de riego utilizarás.'); return; }
    let manejo;
    try {
      manejo = prepararCamposCultivo(campos, numbers.temp);
      if (fecha && !finCultivo(fecha, 1)) throw new Error('Revisa la fecha de siembra.');
    } catch (validationError) { setError(validationError.message); return; }
    const payload = { cultivo_id: Number(cultivoId), modelo_usado: 'xgboost', temperatura: numbers.temp,
      humedad: numbers.hum, precipitacion: numbers.prec, precipitacion_ciclo_mm: numbers.prec,
      fertilizante: numbers.fert, ph_suelo: numbers.ph, tipo_suelo: datos.suelo,
      area_simulada: numbers.area, parametros_campo: manejo };
    if (modoFert === 'producto' && seleccionados.length > 0) payload.plan_fertilizacion = planFertilizacion;
    payload.usar_suelo_ubicacion = Boolean(automaticos.suelo && !modificados.current.suelo);
    if (fecha) payload.fecha_siembra = fecha;
    if (historico && fin) payload.incluir_historico = true;
    setLoading(true);
    try {
      const response = await simulacionService.simular(payload);
      if (!response.exito || !response.resultado || typeof response.resultado !== 'object' || Array.isArray(response.resultado)) throw new Error('No se recibió un resultado válido.');
      setResult(response.resultado); setAreaResultado(numbers.area); setVista('resultado');
      onSimulationCompleted?.({ cultivoId: Number(cultivoId), simulacionId: response.resultado.simulacion_id });
    } catch (failure) { const detail = failure.response?.data?.error; setError(typeof detail === 'string' ? detail : detail?.message || failure.message || 'No se pudo completar la simulación.'); }
    finally { setLoading(false); }
  };

  const placeholdersNum = { area: 'Ej.: 1.5', temp: 'Ej.: 24.5', hum: 'Ej.: 70', prec: 'Ej.: 650', fert: 'Ej.: 120', ph: 'Ej.: 6.2' };
  const campoNumero = (key, id, label, hint) => {
    const bloqueado = Boolean(automaticos[key] && !editarDatos);
    return <div className="form-group"><label className="form-label" htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      <input id={id} type="text" inputMode="decimal" className="form-input" required value={datos[key]} readOnly={bloqueado}
        placeholder={placeholdersNum[key]}
        onChange={event => cambiarDato(key, event.target.value)} onBlur={event => { const value = normalizarDecimalEntrada(event.target.value); if (value !== datos[key]) cambiarDato(key, value); }} />
      {hint && <p className="form-hint">{hint}</p>}
      {automaticos[key] && <span className="simulation-origin">{modificados.current[key] ? 'Ajustado por ti' : 'Dato precargado'}{bloqueado ? ' · Modificar datos para editar' : ''}</span>}
    </div>;
  };
  const cambiarRiego = value => {
    const next = { ...campos, riego_tipo: value };
    if (value === 'temporal_lluvia') next.lamina_riego_mm = '0';
    else if (campos.riego_tipo === 'temporal_lluvia') next.lamina_riego_mm = '';
    cambiarCampos(next);
  };
  const seleccionarTab = next => { setVista(next); tabs.current[next === 'preparar' ? 0 : 1]?.focus(); };

  return <div className="simulation-workbench">
    <header className="simulation-page-heading" hidden={vista === 'resultado'}><div><p className="simulation-eyebrow">Tu parcela · tu escenario</p><h1>Prepara tu cosecha</h1><p>Revisa los datos, completa el manejo y consulta una estimación de grano seco.</p></div><span className="simulation-product"><Sprout size={17} /> Simulación de grano seco</span></header>
    <div className="simulation-tabs" role="tablist" aria-label="Pasos de la simulación" onKeyDown={event => {
      if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); seleccionarTab(event.key === 'Home' || !result ? 'preparar' : event.key === 'End' ? 'resultado' : vista === 'preparar' ? 'resultado' : 'preparar'); }
    }}><button ref={node => { tabs.current[0] = node; }} id="tab-preparar" role="tab" aria-selected={vista === 'preparar'} aria-controls="panel-preparar" tabIndex={vista === 'preparar' ? 0 : -1} onClick={() => setVista('preparar')}><span>1</span> Preparar escenario</button><button ref={node => { tabs.current[1] = node; }} id="tab-resultado" role="tab" aria-selected={vista === 'resultado'} aria-controls="panel-resultado" tabIndex={vista === 'resultado' ? 0 : -1} disabled={!result} onClick={() => setVista('resultado')}><span>2</span> Resultado</button></div>
    {error && <div className="simulation-error" role="alert"><Info size={19} /><p>{error}</p></div>}
    <section id="panel-preparar" role="tabpanel" aria-labelledby="tab-preparar" hidden={vista !== 'preparar'}>
      {onboardingStep === 2 && <p className="simulation-notice">Tu parcela ya está registrada. Completa este escenario para crear tu primera simulación.</p>}
      <div className="simulation-prepare-grid"><form className="simulation-form" noValidate onSubmit={simular}>
        <fieldset disabled={loading}><section className="simulation-section"><header className="simulation-section-heading"><div><span className="simulation-section-number">01</span><h2>Elige tu parcela</h2></div></header>
          <div className="form-group"><label className="form-label" htmlFor="simular-parcela">Parcela de referencia <span aria-hidden="true">*</span></label><select id="simular-parcela" className="form-select" value={cultivoId} onChange={event => seleccionar(event.target.value)}><option value="">Selecciona una parcela</option>{cultivos.map(crop => <option key={crop.id} value={crop.id}>{crop.nombre_parcela} ({crop.area} ha)</option>)}</select></div>
          {parcela && <div className="simulation-location"><MapPin size={19} /><div><strong>{provincia ?? (cargandoDatos ? 'Identificando provincia…' : 'Provincia sin confirmar')}</strong><p>{parcela.ubicacion || 'Coordenadas registradas en la parcela'}</p><span>{parcela.variedad_maiz}</span></div></div>}
        </section>
        <section className="simulation-section"><header className="simulation-section-heading"><div><span className="simulation-section-number">02</span><h2>Revisa los datos del escenario</h2></div><button type="button" className="simulation-edit" onClick={() => setEditarDatos(value => !value)} disabled={!cultivoId}>{editarDatos ? <Check size={16} /> : <Pencil size={16} />}{editarDatos ? 'Listo, usar estos datos' : 'Modificar datos'}</button></header>
          <p>Precargamos las referencias disponibles de ubicación. Puedes modificarlas para este cálculo; no cambiarán el registro de tu parcela.</p>
          {cargandoDatos && <p role="status" className="simulation-loading"><span /> Consultando clima, suelo y provincia…</p>}
          {aviso && <p role="status" className="simulation-notice">{aviso}</p>}
          <div className="simulation-fields-grid">
            {campoNumero('area', 'simular-area', 'Área a simular (ha)')}
            <div className="form-group"><label className="form-label" htmlFor="simular-suelo">Textura del suelo <span aria-hidden="true">*</span></label><select id="simular-suelo" className="form-select" value={datos.suelo} disabled={Boolean(automaticos.suelo && !editarDatos)} onChange={event => cambiarDato('suelo', event.target.value)}><option value="">Selecciona una textura</option>{Object.entries(tiposSuelo).map(([code, rule]) => <option key={code} value={code}>{rule.label}</option>)}</select><p className="form-hint">{referencias?.referencia_suelo ? `Mapa: ${referencias.referencia_suelo.clase_estimada ?? 'textura estimada'}. Se propone el grupo compatible con el modelo; puedes corregirlo.` : 'Si no hay datos de mapa, selecciona el tipo que conoces. No asignamos una textura por defecto sin respaldo.'}</p></div>
            {campoNumero('temp', 'simular-temperatura', 'Temperatura media (°C)', 'Usa una media representativa del ciclo; la referencia reciente puede ser distinta.')}
            {campoNumero('hum', 'simular-humedad', 'Humedad relativa (%)')}
            {campoNumero('prec', 'lluvia-ciclo', 'Lluvia acumulada del ciclo (mm)', 'Acumulado o escenario de lluvia para todo el cultivo. No uses el total anual.')}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Fertilización del plan (afecta la predicción con N, P, K, Mg, S y aplicaciones de N)</label>
              <div className="simulation-mode-toggle">
                <button type="button" className={`simulation-mode-btn ${modoFert === 'producto' ? 'activo' : ''}`} onClick={() => setModoFert('producto')}>Por producto</button>
                <button type="button" className={`simulation-mode-btn ${modoFert === 'nutriente' ? 'activo' : ''}`} onClick={() => setModoFert('nutriente')}>Por nutriente (avanzado)</button>
              </div>
              {modoFert === 'producto' && <>
                <p className="form-hint">Marca los fertilizantes que vas a usar. El nitrógeno calculado rellena la casilla del escenario y P, K, Mg, S y aplicaciones entran al modelo.</p>
                <div className="simulation-chips">
                  {catalogoFert.map(p => (
                    <button type="button" key={p.id} className={`simulation-chip ${seleccionados.includes(p.id) ? 'sel' : ''}`} onClick={() => toggleFert(p.id)}>{p.nombre} <small>{p.formula}</small></button>
                  ))}
                  <button type="button" className="simulation-chip simulation-chip-otro" onClick={() => setFormOtroAbierto(v => !v)}>➕ Otros…</button>
                </div>
                {formOtroAbierto && (
                  <div className="simulation-otro-form">
                    <div className="simulation-otro-grid">
                      <input className="form-input" placeholder="Nombre del producto" value={formOtro.nombre} onChange={e => setFormOtro({ ...formOtro, nombre: e.target.value })} />
                      <input className="form-input" inputMode="decimal" placeholder="% N" value={formOtro.N} onChange={e => setFormOtro({ ...formOtro, N: e.target.value })} />
                      <input className="form-input" inputMode="decimal" placeholder="% P₂O₅" value={formOtro.P} onChange={e => setFormOtro({ ...formOtro, P: e.target.value })} />
                      <input className="form-input" inputMode="decimal" placeholder="% K₂O" value={formOtro.K} onChange={e => setFormOtro({ ...formOtro, K: e.target.value })} />
                      <input className="form-input" inputMode="decimal" placeholder="% Mg" value={formOtro.Mg} onChange={e => setFormOtro({ ...formOtro, Mg: e.target.value })} />
                      <input className="form-input" inputMode="decimal" placeholder="% S" value={formOtro.S} onChange={e => setFormOtro({ ...formOtro, S: e.target.value })} />
                      <input className="form-input" inputMode="decimal" placeholder="Precio/bolsa" value={formOtro.precio} onChange={e => setFormOtro({ ...formOtro, precio: e.target.value })} />
                    </div>
                    <button type="button" className="btn btn-outline" onClick={agregarOtroFert}>Agregar a mi plan</button>
                  </div>
                )}
                {seleccionados.map(id => {
                  const p = findFert(id); const r = inputsFert[id] || {};
                  const dosis = num(r.dosis); const kg = r.unidad === 'kg' ? dosis : dosis * 50;
                  return (
                    <div className="simulation-fert-row" key={id}>
                      <div className="simulation-fert-row-head"><strong>{p?.nombre}</strong> <span className="simulation-fert-formula">{p?.formula}</span>
                        <button type="button" className="simulation-fert-quitar" onClick={() => { setSeleccionados(prev => prev.filter(x => x !== id)); invalidar(); }}>Quitar ✕</button>
                      </div>
                      <div className="simulation-fert-row-grid">
                        <label>Peso<input className="form-input" inputMode="decimal" value={r.dosis || ''} onChange={e => updateInput(id, 'dosis', e.target.value)} /></label>
                        <label>Unidad<select className="form-select" value={r.unidad || 'bolsa'} onChange={e => updateInput(id, 'unidad', e.target.value)}>
                          <option value="bolsa">Bolsa 50 kg</option><option value="kg">kg/ha</option>
                        </select></label>
                        <label>% N<input className="form-input" inputMode="decimal" value={r.N || ''} onChange={e => updateInput(id, 'N', e.target.value)} /></label>
                        <label>Precio/bolsa<input className="form-input" inputMode="decimal" value={r.precio || ''} onChange={e => updateInput(id, 'precio', e.target.value)} /></label>
                      </div>
                      <p className="form-hint">{fmt1(kg)} kg de producto → <strong>{fmt1(kg * pct(r.N || p?.N || 0) / 100)} kg N/ha</strong> · {fmt1(kg * pct(r.P || p?.P || 0) / 100)} P₂O₅ · {fmt1(kg * pct(r.K || p?.K || 0) / 100)} K₂O · {fmt1(kg * pct(r.Mg || p?.Mg || 0) / 100)} Mg · {fmt1(kg * pct(r.S || p?.S || 0) / 100)} S · costo <strong>{fmt1(r.unidad === 'kg' ? (dosis / 50) * num(r.precio || p?.precio) : dosis * num(r.precio || p?.precio))} USD/ha</strong></p>
                    </div>
                  );
                })}
                {seleccionados.length > 0 && (
                  <div className="simulation-fert-totales">
                    <div><strong>N total:</strong> {fmt1(totalN)} kg N/ha</div>
                    <div><strong>P₂O₅:</strong> {fmt1(totalP)} · <strong>K₂O:</strong> {fmt1(totalK)} · <strong>Mg:</strong> {fmt1(totalMg)} · <strong>S:</strong> {fmt1(totalS)} kg/ha</div>
                    <div><strong>Costo:</strong> {fmt1(totalCosto)} USD/ha</div>
                    <p className="form-hint">P, K, Mg y S entran al modelo como parámetros de campo; aplicaciones de N: {aplicacionesN}. INIAP (secano): fracciona el N — mitad a los 15 días y mitad a los 30.</p>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="simular-aplicaciones">Aplicaciones de nitrógeno (veces)</label>
                  <select id="simular-aplicaciones" className="form-select" value={aplicacionesN} onChange={e => { setAplicacionesN(Number(e.target.value)); invalidar(); }}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </>}
              {modoFert === 'nutriente' && <p className="form-hint">Modo avanzado: entra directo los kilos de nutriente en la casilla de abajo.</p>}
              {campoNumero('fert', 'simular-nitrogeno', 'Nitrógeno aplicado (kg N/ha)', modoFert === 'producto' && seleccionados.length > 0 ? 'Calculado con tu plan de fertilización.' : 'Cantidad de nutriente, no peso del producto. 100 kg de urea al 46 % aportan 46 kg de N.')}
            </div>
            {campoNumero('ph', 'simular-ph', 'pH del suelo')}
          </div>
          <p className="simulation-small">Puedes usar coma decimal: se convierte en punto al salir del campo. Escribe los miles sin separadores, por ejemplo 3500.</p>
        </section>
        <section className="simulation-section"><header className="simulation-section-heading"><div><span className="simulation-section-number">03</span><h2>Define el agua del cultivo</h2></div></header><div className="simulation-fields-grid"><div className="form-group"><label className="form-label" htmlFor="campo-riego_tipo">Sistema de agua o riego <span aria-hidden="true">*</span></label><select id="campo-riego_tipo" className="form-select" value={campos.riego_tipo ?? ''} onChange={event => cambiarRiego(event.target.value)}><option value="">Selecciona cómo recibirá agua</option>{Object.entries(definicionesCampo.riego_tipo.opciones).filter(([key]) => key !== 'natural_exceso').map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div><div className="form-group"><label className="form-label" htmlFor="campo-lamina_riego_mm">Agua de riego de todo el ciclo (mm) <small>Opcional</small></label><input id="campo-lamina_riego_mm" className="form-input" type="text" inputMode="decimal" readOnly={campos.riego_tipo === 'temporal_lluvia'} placeholder="Ej.: 120" value={campos.lamina_riego_mm ?? ''} onChange={event => cambiarCampos({ ...campos, lamina_riego_mm: event.target.value })} onBlur={event => cambiarCampos({ ...campos, lamina_riego_mm: normalizarDecimalEntrada(event.target.value) })} /><p className="form-hint">{campos.riego_tipo === 'temporal_lluvia' ? 'Solo lluvia: el agua aportada por riego es 0 mm.' : 'No incluye lluvia. 1 mm equivale a 10 m³ de agua por hectárea.'}</p></div></div></section>
        <ParametrosCampo fecha={fecha} onFechaChange={value => { setFecha(value); setHistorico(false); invalidar(); }} valores={campos} onChange={cambiarCampos} ficha={ficha} historico={historico} onHistoricoChange={value => { setHistorico(value); invalidar(); }} />
        {sinModelo && <p className="simulation-notice">Esta variedad tiene ficha de consulta. Su cálculo específico de rendimiento todavía necesita un modelo compatible; puedes revisar los requisitos en la ayuda de variedades.</p>}
        <footer className="simulation-submit"><p>El cálculo combina tus datos con referencias para las variables que falten. La estimación no garantiza la cosecha.</p><button type="submit" className="btn btn-primary" disabled={loading || cargandoDatos || !cultivoId || sinModelo}>{loading ? 'Calculando tu escenario…' : 'Ejecutar Simulación'}<ArrowRight size={18} /></button></footer>
        </fieldset>
      </form>
      <aside className="simulation-sidebar" aria-label="Ayuda para preparar la simulación"><section className="simulation-section"><h2>Antes de calcular</h2><ul className="simulation-checklist"><li>La superficie puede ser una parte de tu parcela.</li><li>El clima debe representar el ciclo que quieres simular.</li><li>Confirma el riego y las dosis que realmente aplicarás.</li></ul><p className="simulation-small">El resultado es de grano seco. Choclo y canguil tienen requisitos y productos de cosecha diferentes.</p></section>
        <EvaluacionVariedades key={cultivoId} cultivoId={cultivoId} ph={datos.ph} disabled={loading || cargandoDatos} />
        {cultivoId && <details className="simulation-source"><summary>De dónde vienen los datos precargados</summary><p>{referencias?.fuente_provincia ?? 'Provincia indicada en la ubicación registrada.'}</p><p>Suelo: mapas <a href="https://maps.isric.org/" target="_blank" rel="noopener noreferrer">ISRIC SoilGrids</a>, malla de 250 m y capa superficial de 0–5 cm. Es una estimación, no un análisis de laboratorio.</p><p>Provincia: INEC/HDX, distribuido por <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries</a> bajo CC BY 3.0 IGO. Referencia simplificada de 2018.</p><button type="button" className="simulation-edit" disabled={cargandoDatos || loading} onClick={() => { invalidar(); setRecarga(value => value + 1); }}><RefreshCw size={15} /> Volver a consultar referencias</button></details>}
      </aside></div>
    </section>
    <section id="panel-resultado" role="tabpanel" aria-labelledby="tab-resultado" hidden={vista !== 'resultado'}>{result && <ResultadoSimulacion result={result} parcela={parcela} areaSimulada={areaResultado} headingRef={headingResultado} onEditar={() => { setVista('preparar'); setEditarDatos(true); }} onAnalisis={onNavigate ? () => { if (onboardingStep === 2) onNextOnboardingStep?.(); onNavigate('yield'); } : undefined} />}</section>
  </div>;
}
