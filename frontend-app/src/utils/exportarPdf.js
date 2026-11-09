// exportarPdf.js - Herramienta para abrir la ventana de impresión y crear el PDF en español

const escaparHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
})[caracter]);

export function exportarReporteAPdf(datosReporte, ventana = null) {
  const ventanaImpresion = ventana || window.open('', '_blank');
  if (!ventanaImpresion) {
    alert('Por favor activa las ventanas emergentes (popups) para poder imprimir el reporte.');
    return;
  }

  const fechaHoy = new Date().toLocaleDateString('es-EC', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reporte de Gestión - ZeaSys AgroPredict</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #0f172a;
          margin: 20px;
          padding: 0;
          line-height: 1.5;
          font-size: 11pt;
        }
        .header {
          border-bottom: 2px solid #16a34a;
          padding-bottom: 15px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .title {
          font-size: 20pt;
          font-weight: 800;
          color: #15803d;
          margin: 0;
        }
        .subtitle {
          font-size: 10pt;
          color: #475569;
          margin-top: 5px;
        }
        .meta-info {
          font-size: 9pt;
          color: #64748b;
          text-align: right;
          line-height: 1.4;
        }
        .section {
          margin-bottom: 30px;
          break-inside: auto;
        }
        .section-title {
          font-size: 13pt;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 5px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          font-size: 9.5pt;
        }
        th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
        }
        td {
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          color: #475569;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }
        .kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          background: #f8fafc;
          text-align: center;
        }
        .kpi-value {
          font-size: 16pt;
          font-weight: 700;
          color: #16a34a;
          margin-top: 5px;
        }
        .kpi-label {
          font-size: 8.5pt;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        @media print {
          body { margin: 1.5cm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">ZeaSys AgroPredict</div>
          <div class="subtitle">Reporte de Gestión Agrícola y Diagnóstico DSS</div>
        </div>
        <div class="meta-info">
          <strong>Creado por:</strong> ${escaparHtml(datosReporte.meta.exportado_por)}<br>
          <strong>Fecha:</strong> ${fechaHoy}<br>
          <strong>Versión:</strong> ${escaparHtml(datosReporte.meta.formato_version ?? '1')}
        </div>
      </div>
  `;

  if (datosReporte.lotes_gps) {
    html += `
      <div class="section">
        <div class="section-title">Lotes y Parcelas GPS Registradas</div>
        <table>
          <thead>
            <tr>
              <th>Nombre del Lote</th>
              <th>Variedad Maíz</th>
              <th>Tipo Maíz</th>
              <th>Ubicación / Sector</th>
              <th>Área (ha)</th>
              <th>pH Suelo</th>
              <th>Coordenadas (Lat, Lng)</th>
            </tr>
          </thead>
          <tbody>
    `;
    if (datosReporte.lotes_gps.length === 0) html += '<tr><td colspan="7">No hay parcelas registradas.</td></tr>';
    datosReporte.lotes_gps.forEach(l => {
      const tieneCoordenadas = l.latitud !== null && l.latitud !== undefined && l.latitud !== ''
        && l.longitud !== null && l.longitud !== undefined && l.longitud !== '';
      const coords = tieneCoordenadas ? `${l.latitud}, ${l.longitud}` : 'Sin GPS';
      html += `
        <tr>
          <td><strong>${escaparHtml(l.nombre_parcela)}</strong></td>
          <td>${escaparHtml(l.variedad_maiz)}</td>
          <td>${escaparHtml(l.tipo_maiz)}</td>
          <td>${escaparHtml(l.ubicacion || 'No especificada')}</td>
          <td>${escaparHtml(l.area)} ha</td>
          <td>${escaparHtml(l.ph ?? '—')}</td>
          <td>${escaparHtml(coords)}</td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  if (datosReporte.historial_simulaciones) {
    html += `<div class="section"><div class="section-title">Simulaciones guardadas</div><p>Son estimaciones del modelo, no cosechas medidas.</p><table><thead><tr><th>Fecha</th><th>Simulación</th><th>Parcela</th><th>Área (ha)</th><th>Rendimiento (t/ha)</th><th>Producción (t)</th></tr></thead><tbody>`;
    if (datosReporte.historial_simulaciones.length === 0) html += '<tr><td colspan="6">No hay simulaciones guardadas.</td></tr>';
    const valor = (v) => v === null || v === undefined || v === '' ? '—' : escaparHtml(v);
    datosReporte.historial_simulaciones.forEach((s) => {
      const fecha = s.fecha ? new Date(String(s.fecha).replace(' ', 'T')) : null;
      const fechaSim = fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleDateString('es-EC') : '—';
      html += `<tr><td>${escaparHtml(fechaSim)}</td><td>${valor(s.nombre)}</td><td>${valor(s.nombre_parcela)}</td><td>${valor(s.area_simulada)}</td><td>${valor(s.rendimiento_estimado)}</td><td>${valor(s.produccion_total)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  if (datosReporte.registros_campo) {
    html += '<div class="section"><div class="section-title">Registros de campo</div><p>Datos declarados por el productor; no son predicciones ni mediciones verificadas de forma independiente.</p>';
    if (datosReporte.registros_campo.length === 0) html += '<p>No hay parcelas registradas.</p>';
    const nombres = { grano_seco_kg: 'Grano seco (kg)', biomasa_seca_kg: 'Biomasa aérea seca total (kg)', fecha_cosecha: 'Fecha de cosecha', capacidad_campo_pct: 'Capacidad de campo (% vol.)', marchitez_pct: 'Punto de marchitez (% vol.)', profundidad_cm: 'Profundidad (cm)', fecha_suelo: 'Fecha del análisis de suelo', etapa: 'Etapa', fecha_observacion: 'Fecha de observación', plaga: 'Plaga', incidencia_pct: 'Plantas afectadas (%)' };
    datosReporte.registros_campo.forEach((registro) => {
      const entradas = Object.entries(registro.datos || {}).filter(([clave]) => Object.hasOwn(nombres, clave));
      html += `<h3>${escaparHtml(registro.nombre_parcela || `Parcela #${registro.parcela_id}`)}</h3>`;
      if (!entradas.length) html += '<p>Sin mediciones registradas.</p>';
      else html += `<table><tbody>${entradas.map(([clave, valor]) => `<tr><th>${escaparHtml(nombres[clave])}</th><td>${escaparHtml(valor)}</td></tr>`).join('')}</tbody></table>`;
    });
    html += '</div>';
  }

  if (datosReporte.resumen_kpi) {
    html += `
      <div class="section">
        <div class="section-title">Resumen de parcelas</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Parcelas registradas</div>
            <div class="kpi-value">${escaparHtml(datosReporte.resumen_kpi.total_lotes)}</div>
          </div>
        </div>
      </div>
    `;
  }

  html += `
      <div style="margin-top: 40px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
        Este reporte fue generado automáticamente por la Plataforma ZeaSys AgroPredict.
      </div>
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 300);
        });
      </script>
    </body>
    </html>
  `;

  ventanaImpresion.document.open();
  ventanaImpresion.document.write(html);
  ventanaImpresion.document.close();
}
