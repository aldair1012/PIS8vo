# Siembra: jerarquía por tareas

1. **Tu plan de siembra** siempre visible: fecha prevista o realizada, fin aproximado, variedad, duración y agua o riego. La acción principal permite completar o editar el plan.
2. **Ver mis fechas en calendario** es opcional. Las fechas grandes del plan se pueden leer sin interpretar un calendario.
3. **Calendario agrícola de tu zona** siempre visible, solicitado por el usuario: meses seleccionables, ventana institucional, marcas del plan propio, requisitos de suelo y antecedentes sanitarios provinciales. Conservar edición, página y fuente. Sin cobertura no se pintan ventanas. Los antecedentes no son vigilancia actual ni pronóstico. No usar el catálogo generado como fuente certificada.
4. **Consultar simulaciones guardadas** abre resultados pasados. El selector de año está aquí porque filtra cálculos, no el cultivo. Las estadísticas requieren una segunda apertura explícita.

La edición conserva valores ante errores, indica qué corregir y devuelve el foco al terminar. Los datos usados en una simulación requieren aceptación explícita antes de copiarlos al plan. Las fechas pasadas sin clasificación no se presentan como siembras realizadas.

Usar `frontend-app/src/assets/siembra-dashboard.css` para distribución y componentes propios. Conservar los colores semánticos del sistema. El calendario mensual de referencia es ligero. Cargar el calendario diario del plan y los gráficos cuando se consulten. Usar agricultural-calendar.css para el nuevo componente.
