// usarExplicacionIA.js - Hook de React para pedir explicaciones a la IA local en español

import { useRef, useState } from 'react';
import { simulacionService } from '../services/api';

export default function useExplicacionIA(cultivoIdSeleccionado, añoSeleccionado) {
  const [mostrarModalIa, setMostrarModalIa] = useState(false);
  const [cargandoIa, setCargandoIa] = useState(false);
  const [datosIa, setDatosIa] = useState(null);
  const [respuestasIaGuardadas, setRespuestasIaGuardadas] = useState({});
  const solicitudActual = useRef(0);

  const pedirExplicacionIa = async (contexto) => {
    const solicitud = ++solicitudActual.current;
    const clave = JSON.stringify([cultivoIdSeleccionado, añoSeleccionado, contexto]);
    const datoSeleccionado = {
      titulo: contexto.nombre || contexto.titulo,
      valor: contexto.valor,
      unidad: contexto.unidad,
      descripcion_tecnica: contexto.descripcion_tecnica,
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
      const respuesta = await simulacionService.explicarDatos({
        ...contexto,
        cultivo_id: cultivoIdSeleccionado,
        año: añoSeleccionado
      });
      setRespuestasIaGuardadas(anteriores => ({ ...anteriores, [clave]: respuesta }));
      if (solicitud === solicitudActual.current) setDatosIa({ ...datoSeleccionado, ...respuesta });
    } catch {
      if (solicitud === solicitudActual.current) setDatosIa({
        ...datoSeleccionado,
        titulo: contexto.nombre || 'Explicación del Indicador',
        explicacion_breve: 'No se pudo conectar con el motor de simulación local.',
        impacto_en_el_cultivo: 'El motor de simulación no respondió a tiempo.',
        nivel: 'regular',
        recomendacion: 'Verifique que el motor de simulación esté activo e intente nuevamente.',
        alerta: 'Fallo al conectar.',
        offline: true
      });
    } finally {
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
