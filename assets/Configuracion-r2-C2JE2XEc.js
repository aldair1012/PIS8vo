import{r as e}from"./rolldown-runtime-r2-XKyaHtl9.js";import{i as t,t as n}from"./react-r2-Bc2-_y0u.js";import{A as r,L as i,X as a,_t as o,a as s,c,d as l,ft as u,g as d,ht as f,o as p}from"./iconos-r2-Bp8Czmiq.js";import{a as ee,i as te,n as m,o as ne}from"./api-r2-BV665iHj.js";import{n as h}from"./PrivacidadAsistente-r2-CzVQ9nP_.js";var g=e(t(),1);async function _({secciones:e,usuario:t,obtenerParcelas:n,obtenerHistorial:r,obtenerMediciones:i,progreso:a=()=>{},ahora:o=new Date}){if(!Object.values(e).some(Boolean))throw Error(`Selecciona al menos una sección para descargar.`);let s={meta:{app:`ZeaSys`,exportado_por:t.nombre,fecha_exportacion:o.toISOString(),formato_version:1}},c=[];if(e.cultivos||e.kpis||e.mediciones){a(`Consultando parcelas…`);let e=await n();if(c=Array.isArray(e)?e:e?.cultivos,!Array.isArray(c))throw Error(`No se pudo comprobar la lista de parcelas.`)}if(e.cultivos&&(s.lotes_gps=c),e.simulaciones){a(`Consultando historial de simulaciones…`);let e=await r(null,1,100),{total:t,paginas:n}=e?.paginacion??{};if(!Number.isInteger(t)||t<0||!Number.isInteger(n)||n<1||!Array.isArray(e.simulaciones))throw Error(`No se pudo comprobar el historial de simulaciones.`);let i=[...e.simulaciones];for(let e=2;e<=n;e+=1){a(`Consultando simulaciones: página ${e} de ${n}…`);let o=await r(null,e,100);if(!Array.isArray(o?.simulaciones)||o.paginacion?.total!==t||o.paginacion?.paginas!==n||o.paginacion?.pagina!==e)throw Error(`El historial cambió durante la descarga. Inténtalo de nuevo.`);i.push(...o.simulaciones)}let o=new Set(i.map(e=>String(e.id??``)));if(i.length!==t||o.has(``)||o.size!==t)throw Error(`No se pudo obtener el historial completo. Inténtalo de nuevo.`);s.historial_simulaciones=i}if(e.mediciones){s.registros_campo=[];for(let[e,t]of c.entries()){a(`Consultando registros de campo: ${e+1} de ${c.length}…`);let n=await i(t.id);if(!n||typeof n.datos!=`object`||n.datos===null)throw Error(`No se pudieron comprobar los registros de campo.`);s.registros_campo.push({parcela_id:t.id,nombre_parcela:t.nombre_parcela,...n})}}return e.kpis&&(s.resumen_kpi={total_lotes:c.length}),s}function v(e){let t=JSON.stringify(e,null,2),n=new Blob([t],{type:`application/json;charset=utf-8`});if(!n.size)throw Error(`El archivo está vacío. Inténtalo de nuevo.`);return n}var y=e=>String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`})[e]);function b(e,t=null){let n=t||window.open(``,`_blank`);if(!n){alert(`Por favor activa las ventanas emergentes (popups) para poder imprimir el reporte.`);return}let r=new Date().toLocaleDateString(`es-EC`,{year:`numeric`,month:`long`,day:`numeric`,hour:`2-digit`,minute:`2-digit`}),i=`
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
          <strong>Creado por:</strong> ${y(e.meta.exportado_por)}<br>
          <strong>Fecha:</strong> ${r}<br>
          <strong>Versión:</strong> ${y(e.meta.formato_version??`1`)}
        </div>
      </div>
  `;if(e.lotes_gps&&(i+=`
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
    `,e.lotes_gps.length===0&&(i+=`<tr><td colspan="7">No hay parcelas registradas.</td></tr>`),e.lotes_gps.forEach(e=>{let t=e.latitud!==null&&e.latitud!==void 0&&e.latitud!==``&&e.longitud!==null&&e.longitud!==void 0&&e.longitud!==``?`${e.latitud}, ${e.longitud}`:`Sin GPS`;i+=`
        <tr>
          <td><strong>${y(e.nombre_parcela)}</strong></td>
          <td>${y(e.variedad_maiz)}</td>
          <td>${y(e.tipo_maiz)}</td>
          <td>${y(e.ubicacion||`No especificada`)}</td>
          <td>${y(e.area)} ha</td>
          <td>${y(e.ph??`—`)}</td>
          <td>${y(t)}</td>
        </tr>
      `}),i+=`
          </tbody>
        </table>
      </div>
    `),e.historial_simulaciones){i+=`<div class="section"><div class="section-title">Simulaciones guardadas</div><p>Son estimaciones del modelo, no cosechas medidas.</p><table><thead><tr><th>Fecha</th><th>Simulación</th><th>Parcela</th><th>Área (ha)</th><th>Rendimiento (t/ha)</th><th>Producción (t)</th></tr></thead><tbody>`,e.historial_simulaciones.length===0&&(i+=`<tr><td colspan="6">No hay simulaciones guardadas.</td></tr>`);let t=e=>e==null||e===``?`—`:y(e);e.historial_simulaciones.forEach(e=>{let n=e.fecha?new Date(String(e.fecha).replace(` `,`T`)):null,r=n&&!Number.isNaN(n.getTime())?n.toLocaleDateString(`es-EC`):`—`;i+=`<tr><td>${y(r)}</td><td>${t(e.nombre)}</td><td>${t(e.nombre_parcela)}</td><td>${t(e.area_simulada)}</td><td>${t(e.rendimiento_estimado)}</td><td>${t(e.produccion_total)}</td></tr>`}),i+=`</tbody></table></div>`}if(e.registros_campo){i+=`<div class="section"><div class="section-title">Registros de campo</div><p>Datos declarados por el productor; no son predicciones ni mediciones verificadas de forma independiente.</p>`,e.registros_campo.length===0&&(i+=`<p>No hay parcelas registradas.</p>`);let t={grano_seco_kg:`Grano seco (kg)`,biomasa_seca_kg:`Biomasa aérea seca total (kg)`,fecha_cosecha:`Fecha de cosecha`,capacidad_campo_pct:`Capacidad de campo (% vol.)`,marchitez_pct:`Punto de marchitez (% vol.)`,profundidad_cm:`Profundidad (cm)`,fecha_suelo:`Fecha del análisis de suelo`,etapa:`Etapa`,fecha_observacion:`Fecha de observación`,plaga:`Plaga`,incidencia_pct:`Plantas afectadas (%)`};e.registros_campo.forEach(e=>{let n=Object.entries(e.datos||{}).filter(([e])=>Object.hasOwn(t,e));i+=`<h3>${y(e.nombre_parcela||`Parcela #${e.parcela_id}`)}</h3>`,n.length?i+=`<table><tbody>${n.map(([e,n])=>`<tr><th>${y(t[e])}</th><td>${y(n)}</td></tr>`).join(``)}</tbody></table>`:i+=`<p>Sin mediciones registradas.</p>`}),i+=`</div>`}e.resumen_kpi&&(i+=`
      <div class="section">
        <div class="section-title">Resumen de parcelas</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Parcelas registradas</div>
            <div class="kpi-value">${y(e.resumen_kpi.total_lotes)}</div>
          </div>
        </div>
      </div>
    `),i+=`
      <div style="margin-top: 40px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
        Este reporte fue generado automáticamente por la Plataforma ZeaSys AgroPredict.
      </div>
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 300);
        });
      <\/script>
    </body>
    </html>
  `,n.document.open(),n.document.write(i),n.document.close()}var x=n();function S({user:e,setUser:t,theme:n,setTheme:y,cerrarSesion:S,cultivos:C}){let[w,T]=(0,g.useState)(e?.nombre||``),E=e?.correo||``,[D,O]=(0,g.useState)(``),[k,A]=(0,g.useState)(``),[j,M]=(0,g.useState)(!1),[N,P]=(0,g.useState)(!1),F=(0,g.useRef)(null),[I,L]=(0,g.useState)(!1),[R,z]=(0,g.useState)(null),[B,V]=(0,g.useState)(null),[H,U]=(0,g.useState)(!1),W=async e=>{let n=e.target.files&&e.target.files[0];if(n){if(z(null),V(null),n.size>5242880)V(`El archivo seleccionado supera el límite máximo de 5 MB. Por favor elige una imagen más liviana.`),e.target.value=``;else if(![`image/jpeg`,`image/png`,`image/webp`,`image/gif`].includes(n.type))V(`El formato del archivo no es permitido. Por favor sube una imagen JPG, PNG, WEBP o GIF.`),e.target.value=``;else{L(!0);try{let e=await m.subirAvatar(n);e.exito&&(t(e.usuario),z(`¡Foto de perfil actualizada con éxito!`))}catch(e){V(e.response?.data?.error||`Error al subir la foto de perfil.`)}finally{L(!1),e.target.value=``}}}},G=async()=>{if(window.confirm(`¿Deseas quitar tu foto de perfil actual?`)){z(null),V(null),L(!0);try{let e=await m.eliminarAvatar();e.exito&&(t(e.usuario),z(`Foto de perfil eliminada correctamente.`))}catch(e){V(e.response?.data?.error||`Error al eliminar la foto de perfil.`)}finally{L(!1)}}},re=async()=>{window.google?.accounts?.oauth2?(L(!0),V(null),z(null),window.google.accounts.oauth2.initTokenClient({client_id:`200107748008-3j1itt8eobnbec6ur1n4vguj4r999k3d.apps.googleusercontent.com`,scope:`profile email`,callback:async e=>{if(e&&e.access_token)try{let n=await(await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`,{headers:{Authorization:`Bearer ${e.access_token}`}})).json();if(n.picture){let e=n.picture.replace(/=s\d+(-c)?$/i,`=s400`),r=await m.sincronizarAvatarGoogle(e);r.exito&&(t(r.usuario),z(`¡Foto de perfil sincronizada con tu cuenta de Google en Alta Definición!`))}else V(`Tu cuenta de Google no posee una foto de perfil personalizada.`)}catch{V(`Error al obtener la foto de perfil desde Google.`)}finally{L(!1)}else L(!1)}}).requestAccessToken()):V(`El servicio de Google Sign-In no está listo aún. Intenta nuevamente.`)},[K,ie]=(0,g.useState)({cultivos:!0,simulaciones:!0,mediciones:!1,kpis:!0}),[q,ae]=(0,g.useState)(`json`),[J,Y]=(0,g.useState)(!1),[oe,X]=(0,g.useState)(!1),[Z,Q]=(0,g.useState)(null),[se,$]=(0,g.useState)(``);return(0,x.jsxs)(`div`,{className:`settings-page`,children:[(0,x.jsx)(`header`,{className:`settings-intro`,children:(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{className:`settings-eyebrow`,children:`TU ESPACIO · ZEASYS`}),(0,x.jsx)(`h1`,{children:`Tu cuenta y preferencias`}),(0,x.jsx)(`p`,{children:`Gestiona tu perfil, la apariencia y tus descargas en un solo lugar.`})]})}),R&&(0,x.jsxs)(`div`,{className:`settings-feedback settings-feedback--success`,role:`status`,children:[(0,x.jsx)(f,{size:18,"aria-hidden":`true`}),R]}),B&&(0,x.jsxs)(`div`,{className:`settings-feedback settings-feedback--error`,role:`alert`,children:[(0,x.jsx)(p,{size:18,"aria-hidden":`true`}),B]}),(0,x.jsxs)(`div`,{className:`settings-layout`,children:[(0,x.jsxs)(`div`,{className:`settings-main`,children:[(0,x.jsxs)(`section`,{className:`settings-card`,"aria-labelledby":`settings-cuenta`,children:[(0,x.jsxs)(`header`,{className:`settings-card-heading`,children:[(0,x.jsx)(`span`,{className:`settings-icon`,children:(0,x.jsx)(s,{size:20,"aria-hidden":`true`})}),(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`h2`,{id:`settings-cuenta`,children:`Tu perfil`}),(0,x.jsx)(`p`,{children:`La información con la que te identificas en ZeaSys.`})]})]}),(0,x.jsxs)(`div`,{className:`settings-profile`,children:[(0,x.jsxs)(`div`,{className:`settings-avatar`,children:[e?.foto_perfil&&(0,x.jsx)(`img`,{src:e.foto_perfil,alt:``,referrerPolicy:`no-referrer`,onError:e=>{e.currentTarget.style.display=`none`,e.currentTarget.nextElementSibling.style.display=`flex`}}),(0,x.jsx)(`span`,{style:{display:e?.foto_perfil?`none`:`flex`},children:e?.nombre?.charAt(0).toUpperCase()||(0,x.jsx)(s,{size:24})})]}),(0,x.jsxs)(`div`,{className:`settings-profile-copy`,children:[(0,x.jsx)(`strong`,{children:e.nombre}),(0,x.jsx)(`span`,{children:E}),Number(e.es_google)===1&&(0,x.jsx)(`small`,{children:`Cuenta vinculada a Google`})]}),(0,x.jsxs)(`div`,{className:`settings-avatar-actions`,children:[(0,x.jsx)(`input`,{type:`file`,ref:F,accept:`image/jpeg,image/png,image/webp,image/gif`,onChange:W,hidden:!0}),(0,x.jsxs)(`button`,{type:`button`,className:`settings-button`,disabled:I,onClick:()=>F.current?.click(),children:[(0,x.jsx)(o,{size:16}),I?`Cargando…`:e?.foto_perfil?`Cambiar foto`:`Subir foto`]}),e?.foto_perfil&&(0,x.jsx)(`button`,{type:`button`,className:`settings-icon-button`,disabled:I,onClick:G,"aria-label":`Quitar foto de perfil`,title:`Quitar foto de perfil`,children:(0,x.jsx)(c,{size:17})}),window.google?.accounts?.oauth2&&(0,x.jsx)(`button`,{type:`button`,className:`settings-button`,disabled:I,onClick:re,children:`Sincronizar Google`})]}),(0,x.jsx)(`p`,{className:`settings-photo-hint`,children:`JPG, PNG, WEBP o GIF · Máximo 5 MB`})]}),(0,x.jsxs)(`div`,{className:`settings-row`,children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{className:`settings-label`,children:`Nombre`}),(0,x.jsx)(`strong`,{children:e.nombre})]}),(0,x.jsx)(`button`,{type:`button`,className:`settings-button`,"aria-expanded":j,onClick:()=>{T(e.nombre),M(!j),P(!1)},children:j?`Cancelar`:`Editar nombre`})]}),j&&(0,x.jsxs)(`form`,{className:`settings-form`,onSubmit:async e=>{e.preventDefault(),z(null),V(null),U(!0);try{let e=await m.actualizarPerfil({nombre:w,correo:E});e.exito&&(t(e.usuario),z(e.mensaje),M(!1))}catch(e){V(e.response?.data?.error||`Error al actualizar el perfil.`)}finally{U(!1)}},children:[(0,x.jsx)(`label`,{htmlFor:`settings-nombre`,children:`Nombre completo`}),(0,x.jsx)(`input`,{id:`settings-nombre`,type:`text`,placeholder:`Nombre completo`,value:w,onChange:e=>T(e.target.value),maxLength:100,required:!0,autoComplete:`name`}),(0,x.jsx)(`button`,{type:`submit`,className:`settings-button settings-button--primary`,disabled:H,children:H?`Guardando…`:`Guardar nombre`})]}),(0,x.jsx)(`div`,{className:`settings-row`,children:(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{className:`settings-label`,children:`Correo electrónico`}),(0,x.jsx)(`strong`,{className:`settings-email`,children:E}),(0,x.jsx)(`small`,{children:`El correo no se puede modificar desde aquí.`})]})}),(0,x.jsxs)(`div`,{className:`settings-row`,children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{className:`settings-label`,children:`Contraseña`}),(0,x.jsx)(`strong`,{children:`••••••••••`}),(0,x.jsx)(`small`,{children:`Úsala para acceder a tu cuenta.`})]}),(0,x.jsx)(`button`,{type:`button`,className:`settings-button`,"aria-expanded":N,onClick:()=>{P(!N),M(!1)},children:N?`Cancelar`:`Cambiar contraseña`})]}),N&&(0,x.jsxs)(`form`,{className:`settings-form`,onSubmit:async t=>{if(t.preventDefault(),z(null),V(null),U(!0),D.length<8)V(`La nueva contraseña debe tener al menos 8 letras o números.`),U(!1);else if(D!==k)V(`Las contraseñas no coinciden, verifícalas bien.`),U(!1);else try{(await m.actualizarPerfil({nombre:e.nombre,correo:e.correo,nueva_contrasena:D,confirmar_nueva_contrasena:k})).exito&&(z(`¡Contraseña cambiada con éxito!`),O(``),A(``),P(!1))}catch(e){V(e.response?.data?.error||`Error al cambiar la contraseña.`)}finally{U(!1)}},children:[(0,x.jsx)(`p`,{children:`Usa al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.`}),(0,x.jsx)(`label`,{htmlFor:`settings-clave`,children:`Nueva contraseña`}),(0,x.jsx)(`input`,{id:`settings-clave`,type:`password`,value:D,onChange:e=>O(e.target.value),autoComplete:`new-password`,minLength:8,required:!0}),(0,x.jsx)(`label`,{htmlFor:`settings-clave-confirmar`,children:`Confirmar contraseña`}),(0,x.jsx)(`input`,{id:`settings-clave-confirmar`,type:`password`,value:k,onChange:e=>A(e.target.value),autoComplete:`new-password`,minLength:8,required:!0}),(0,x.jsx)(`button`,{type:`submit`,className:`settings-button settings-button--primary`,disabled:H,children:H?`Guardando…`:`Actualizar contraseña`})]})]}),(0,x.jsxs)(`section`,{className:`settings-card`,"aria-labelledby":`settings-seguridad`,children:[(0,x.jsxs)(`header`,{className:`settings-card-heading`,children:[(0,x.jsx)(`span`,{className:`settings-icon`,children:(0,x.jsx)(d,{size:20,"aria-hidden":`true`})}),(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`h2`,{id:`settings-seguridad`,children:`Seguridad y sesión`}),(0,x.jsx)(`p`,{children:`Controla el acceso y la permanencia de tu cuenta.`})]})]}),(0,x.jsxs)(`div`,{className:`settings-row`,children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`strong`,{children:`Cerrar sesión`}),(0,x.jsx)(`small`,{children:`Sal de tu cuenta en este dispositivo.`})]}),(0,x.jsxs)(`button`,{type:`button`,className:`settings-button`,onClick:S,children:[(0,x.jsx)(i,{size:16}),`Cerrar sesión`]})]}),(0,x.jsxs)(`div`,{className:`settings-row settings-danger`,children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`strong`,{children:`Eliminar cuenta`}),(0,x.jsx)(`small`,{children:`Elimina tu cuenta, parcelas y simulaciones de forma permanente.`})]}),(0,x.jsxs)(`button`,{type:`button`,className:`settings-button settings-button--danger`,onClick:async()=>{if(window.confirm(`¿Seguro que quieres borrar tu cuenta? Esta acción va a eliminar todos tus lotes y simulaciones guardadas de forma permanente. No se puede deshacer.`)){V(null),z(null),U(!0);try{await m.eliminarCuenta(),await S()}catch(e){V(e.response?.data?.error||`No se pudo eliminar la cuenta. Inténtalo de nuevo.`),U(!1)}}},disabled:H,children:[(0,x.jsx)(c,{size:16}),`Eliminar cuenta`]})]})]})]}),(0,x.jsxs)(`div`,{className:`settings-aside`,children:[(0,x.jsx)(h,{}),(0,x.jsxs)(`section`,{className:`settings-card`,"aria-labelledby":`settings-apariencia`,children:[(0,x.jsxs)(`header`,{className:`settings-card-heading`,children:[(0,x.jsx)(`span`,{className:`settings-icon`,children:(0,x.jsx)(l,{size:20,"aria-hidden":`true`})}),(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`h2`,{id:`settings-apariencia`,children:`Apariencia`}),(0,x.jsx)(`p`,{children:`Elige el tema que te resulte más cómodo.`})]})]}),(0,x.jsx)(`div`,{className:`settings-theme-grid`,role:`group`,"aria-label":`Tema de la aplicación`,children:[[`dark`,`Oscuro`,r],[`light`,`Claro`,l]].map(([e,t,r])=>(0,x.jsxs)(`button`,{type:`button`,className:`settings-theme ${n===e?`is-active`:``}`,"aria-pressed":n===e,onClick:()=>y(e),children:[(0,x.jsx)(r,{size:21,"aria-hidden":`true`}),(0,x.jsx)(`span`,{children:t}),n===e&&(0,x.jsx)(f,{size:16,className:`settings-theme-check`,"aria-hidden":`true`})]},e))})]}),(0,x.jsxs)(`section`,{className:`settings-card`,"aria-labelledby":`settings-exportar`,children:[(0,x.jsxs)(`header`,{className:`settings-card-heading`,children:[(0,x.jsx)(`span`,{className:`settings-icon`,children:(0,x.jsx)(a,{size:20,"aria-hidden":`true`})}),(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`h2`,{id:`settings-exportar`,children:`Descargar información`}),(0,x.jsx)(`p`,{children:`Guarda una copia de los datos que necesites.`})]})]}),(0,x.jsxs)(`fieldset`,{className:`settings-options`,disabled:J,children:[(0,x.jsx)(`legend`,{children:`¿Qué quieres incluir?`}),[[`cultivos`,`Parcelas registradas (${C.length})`,`Datos de tus lotes y ubicación.`],[`simulaciones`,`Historial de simulaciones`,`Tus simulaciones guardadas.`],[`mediciones`,`Registros de campo`,`Mediciones y observaciones de tus parcelas.`],[`kpis`,`Resumen de parcelas`,`Cantidad de parcelas registradas.`]].map(([e,t,n])=>(0,x.jsxs)(`label`,{className:`settings-option`,children:[(0,x.jsx)(`input`,{type:`checkbox`,checked:K[e],onChange:t=>{ie({...K,[e]:t.target.checked}),X(!1),Q(null)}}),(0,x.jsxs)(`span`,{children:[(0,x.jsx)(`strong`,{children:t}),(0,x.jsx)(`small`,{children:n})]})]},e))]}),(0,x.jsxs)(`fieldset`,{className:`settings-formats`,disabled:J,children:[(0,x.jsx)(`legend`,{children:`Formato`}),(0,x.jsx)(`div`,{className:`settings-format-grid`,children:[[`json`,`JSON`,`Archivo de datos`],[`pdf`,`PDF`,`Para guardar o imprimir`]].map(([e,t,n])=>(0,x.jsxs)(`label`,{className:q===e?`is-active`:``,children:[(0,x.jsx)(`input`,{type:`radio`,name:`formatoExportar`,value:e,checked:q===e,onChange:()=>{ae(e),X(!1),Q(null)}}),(0,x.jsxs)(`span`,{children:[(0,x.jsx)(`strong`,{children:t}),(0,x.jsx)(`small`,{children:n})]})]},e))})]}),(0,x.jsxs)(`p`,{className:`settings-export-note`,children:[q===`json`?`JSON conserva los datos seleccionados para uso técnico.`:`PDF prepara un informe resumido para imprimir o guardar.`,` La copia puede incluir ubicaciones y datos de tus parcelas.`]}),J&&(0,x.jsx)(`p`,{className:`settings-export-progress`,role:`status`,children:se||`Preparando descarga…`}),Z&&(0,x.jsx)(`p`,{className:`settings-export-error`,role:`alert`,children:Z}),oe&&(0,x.jsx)(`p`,{className:`settings-export-success`,role:`status`,children:q===`pdf`?`Se abrió la ventana de impresión. Allí puedes guardar el PDF.`:`Tu archivo está listo.`}),(0,x.jsxs)(`button`,{type:`button`,className:`settings-button settings-button--primary settings-download`,onClick:async()=>{let t=q===`pdf`?window.open(``,`_blank`):null;if(q===`pdf`&&!t)Q(`Permite las ventanas emergentes para generar el PDF e inténtalo de nuevo.`);else{t&&t.document.write(`<!doctype html><html lang="es"><title>Preparando informe</title><body><p>Preparando tu informe de ZeaSys…</p></body></html>`),Y(!0),X(!1),Q(null);try{let n=await _({secciones:K,usuario:e,obtenerParcelas:ee.listar,obtenerHistorial:ne.historial,obtenerMediciones:te.getRendimientoMediciones,progreso:$});if(q===`json`){let e=URL.createObjectURL(v(n)),t=document.createElement(`a`);t.href=e,t.download=`datos_zeasys_${new Date().toISOString().slice(0,10)}.json`,document.body.appendChild(t),t.click(),t.remove(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}else b(n,t);X(!0)}catch(e){t?.close(),Q(e.response?.data?.error||(e.response?`No se pudo consultar toda la información. Inténtalo de nuevo.`:e.message===`Network Error`?`No se pudo conectar al servidor. Inténtalo de nuevo.`:e.message)||`No se pudo preparar la descarga. Inténtalo de nuevo.`)}finally{Y(!1),$(``)}}},disabled:J||!Object.values(K).some(Boolean),children:[(0,x.jsx)(a,{size:17}),J?`Preparando…`:q===`pdf`?`Preparar PDF`:`Descargar JSON`,(0,x.jsx)(u,{size:16})]})]})]})]})]})}export{S as default};