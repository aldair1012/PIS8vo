// exportarPdf.js - Herramienta para abrir la ventana de impresión y crear el PDF en español

const escaparHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
})[caracter]);

export function exportarReporteAPdf(datosReporte) {
  const ventanaImpresion = window.open('', '_blank');
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
          page-break-inside: avoid;
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
          <strong>Versión:</strong> v${escaparHtml(datosReporte.meta.version)}
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
          <td>${escaparHtml(l.ph || '—')}</td>
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
    html += `
      <div class="section">
        <div class="section-title">Historial de Simulaciones y Proyecciones Biofísicas</div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre Simulación</th>
              <th>Modelo</th>
              <th>Clima (T / H / P)</th>
              <th>N (kg/ha)</th>
              <th>pH / Suelo</th>
              <th>Área (ha)</th>
              <th>Rendimiento Estimado</th>
              <th>Producción</th>
              <th>Confianza</th>
            </tr>
          </thead>
          <tbody>
    `;
    datosReporte.historial_simulaciones.forEach(s => {
      const fechaSim = new Date(s.fecha).toLocaleDateString('es-EC', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      html += `
        <tr>
          <td>${escaparHtml(fechaSim)}</td>
          <td><strong>${escaparHtml(s.nombre)}</strong></td>
          <td><code style="background:#f1f5f9;padding:2px 4px;border-radius:4px;">${escaparHtml(s.modelo_usado)}</code></td>
          <td>${escaparHtml(s.temperatura)}°C / ${escaparHtml(s.humedad)}% / ${escaparHtml(s.precipitacion)}mm</td>
          <td>${escaparHtml(s.fertilizante)} kg</td>
          <td>${escaparHtml(s.ph_suelo)} / ${escaparHtml(s.tipo_suelo)}</td>
          <td>${escaparHtml(s.area_simulada)} ha</td>
          <td style="color:#15803d;font-weight:700;">${Number(s.rendimiento_estimado).toFixed(2)} t/ha</td>
          <td>${escaparHtml(s.produccion_total)} t</td>
          <td>${escaparHtml(s.confianza)}%</td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  if (datosReporte.resumen_kpi) {
    html += `
      <div class="section">
        <div class="section-title">Resumen de Métricas KPI</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Lotes Monitoreados</div>
            <div class="kpi-value">${escaparHtml(datosReporte.resumen_kpi.total_lotes)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Eficiencia Estimada</div>
            <div class="kpi-value" style="color:#2563eb;">${escaparHtml(datosReporte.resumen_kpi.porcentaje_eficiencia)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Estado Clima</div>
            <div class="kpi-value" style="color:#d97706;">${escaparHtml(datosReporte.resumen_kpi.analisis_clima)}</div>
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
