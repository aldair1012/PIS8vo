// usarExplicacionIA.js - Hook de React para pedir explicaciones a la IA local en español

import { useState } from 'react';
import { simulacionService } from '../services/api';

export default function usarExplicacionIA(cultivoIdSeleccionado, anioSeleccionado) {
  const [mostrarModalIa, setMostrarModalIa] = useState(false);
  const [cargandoIa, setCargandoIa] = useState(false);
  const [datosIa, setDatosIa] = useState(null);
  const [respuestasIaGuardadas, setRespuestasIaGuardadas] = useState({});

  const pedirExplicacionIa = async (contexto) => {
    if (respuestasIaGuardadas[contexto.nombre]) {
      setDatosIa(respuestasIaGuardadas[contexto.nombre]);
      setMostrarModalIa(true);
      return;
    }
    setMostrarModalIa(true);
    setCargandoIa(true);
    setDatosIa(null);
    try {
      const respuesta = await simulacionService.explainData({
        ...contexto,
        cultivo_id: cultivoIdSeleccionado,
        anio: anioSeleccionado
      });
      setRespuestasIaGuardadas(anteriores => ({ ...anteriores, [contexto.nombre]: respuesta }));
      setDatosIa(respuesta);
    } catch (error) {
      setDatosIa({
        titulo: contexto.nombre || 'Explicación del Indicador',
        explicacion_breve: 'No se pudo conectar con el motor de simulación local.',
        impacto_en_el_cultivo: 'El motor de simulación no respondió a tiempo.',
        nivel: 'regular',
        recomendacion: 'Verifique que el motor de simulación esté activo e intente nuevamente.',
        alerta: 'Fallo al conectar.',
        offline: true
      });
    } finally {
      setCargandoIa(false);
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
