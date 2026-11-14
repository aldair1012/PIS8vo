// usarExplicacionIA.js - Hook de React para pedir explicaciones a la IA local en español

import { useRef, useState } from 'react';
import { simulacionService } from '../services/api';

export default function useExplicacionIA(cultivoIdSeleccionado, añoSeleccionado, contextoId = null) {
  const claveVista = JSON.stringify([cultivoIdSeleccionado, añoSeleccionado, contextoId]);
  const [modal, setModal] = useState({ clave: claveVista, abierto: false });
  // Close on a context change, including a later return to a previous plot,
  // year or execution. Merely hiding an old key would reopen stale content.
  if (modal.clave !== claveVista) setModal({ clave: claveVista, abierto: false });
  const mostrarModalIa = modal?.clave === claveVista && modal.abierto;
  const setMostrarModalIa = abierto => setModal({ clave: claveVista, abierto });
  const [cargandoIa, setCargandoIa] = useState(false);
  const [datosIa, setDatosIa] = useState(null);
  const [respuestasIaGuardadas, setRespuestasIaGuardadas] = useState({});
  const solicitudActual = useRef(0);
  const pendientes = useRef(new Map());

  const pedirExplicacionIa = async (contexto) => {
    const solicitud = ++solicitudActual.current;
    const clave = JSON.stringify([cultivoIdSeleccionado, añoSeleccionado, contexto]);
    const { guia_lectura: guiaLectura, ...contextoServidor } = contexto;
    const datoSeleccionado = {
      titulo: contexto.nombre || contexto.titulo,
      valor: contexto.valor,
      unidad: contexto.unidad,
      descripcion_tecnica: contexto.descripcion_tecnica,
      guia_lectura: guiaLectura,
      explicacion_id: solicitud,
    };
    if (respuestasIaGuardadas[clave]) {
      setDatosIa({ ...datoSeleccionado, ...respuestasIaGuardadas[clave] });
      setMostrarModalIa(true);
      setCargandoIa(false);
      return;
    }
    setMostrarModalIa(true);
    setCargandoIa(true);
    setDatosIa(datoSeleccionado);
    try {
      if (!pendientes.current.has(clave)) pendientes.current.set(clave, simulacionService.explicarDatos({
        ...contextoServidor, cultivo_id: cultivoIdSeleccionado, año: añoSeleccionado
      }));
      const respuesta = await pendientes.current.get(clave);
      setRespuestasIaGuardadas(anteriores => ({ ...anteriores, [clave]: respuesta }));
      if (solicitud === solicitudActual.current) setDatosIa({ ...datoSeleccionado, ...respuesta });
    } catch {
      if (solicitud === solicitudActual.current) setDatosIa({
        ...datoSeleccionado,
        titulo: contexto.nombre || 'Explicación del Indicador',
        explicacion_breve: contexto.descripcion_tecnica || 'No se pudo cargar el detalle adicional de este dato.',
        detalle_no_disponible: true,
      });
    } finally {
      pendientes.current.delete(clave);
      if (solicitud === solicitudActual.current) setCargandoIa(false);
    }
  };

  return {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    setDatosIa,
    respuestasIaGuardadas,
    setRespuestasIaGuardadas,
    pedirExplicacionIa
  };
}
