# Tipos y variedades del formulario de parcelas

El formulario de **Mis lotes** pide primero el tipo de maíz y después filtra las variedades compatibles. El catálogo muestra materiales documentados para Ecuador y ofrece **Otra variedad local o comercial (especificar)** para guardar el nombre exacto de la semilla.

Actualización del 8 de noviembre de 2026: el catálogo compartido incluye 14 fichas (13 materiales con etiqueta utilizable y canguil para consulta) y una consulta de adaptación en Simular cosecha. Ver [alcance, fuentes, lógica y límites de la integración](catalogo-variedades-20261107.md). Las etiquetas presentes en XGBoost y los requisitos documentales se distinguen explícitamente.

Los tres valores almacenados para `tipo_maiz` se conservan para seguir siendo compatibles con la codificación del predictor: `Duro Amarillo`, `Duro Amarillo / Blanco` y `Suave Harinoso`. Por ese límite, la lista está organizada en esos grupos y no crea categorías que el modelo actual no reconoce.

La selección reducida y los 24 retiros activos se detallan en [decisiones de selección](seleccion-variedades-20261107.md). El grupo de canguil y maíz blanco duro contiene INIAP 198 como ficha de consulta; el cálculo específico está bloqueado por una inconsistencia del entrenamiento. Los grupos de choclo distinguen destinos blanco y amarillo en las fichas.

## Fuentes de revisión, incluyendo materiales retirados

- Fichas de maíz duro del INIAP: H-551, H-553, H-601, H-602, H-603 y materiales relacionados; [fichas INIAP](https://tecnologia.iniap.gob.ec/wp-content/uploads/2023/11/fichasmaizduro.pdf).
- INIAP 515, 526, 527 y 542; [ficha INIAP 515](https://repositorio.iniap.gob.ec/items/70cca6e7-5839-4076-829b-fd8c216547cb), [INIAP 526](https://repositorio.iniap.gob.ec/server/api/core/bitstreams/93329863-b031-4ad5-ad16-fa1ff6920a49/content), [INIAP 527](https://repositorio.iniap.gob.ec/items/5b5aec16-40b5-4bcd-9d8b-5ba6bd54eb2d) e [INIAP 540/542](https://repositorio.iniap.gob.ec/items/2e61aff8-3943-45c7-949f-d7b320b2295b).
- Pichilingue 504 y 513; [Pichilingue 504](https://repositorio.iniap.gob.ec/items/c324c16b-8d9f-4a6c-a030-78c06cb89adb) y [Pichilingue 513](https://repositorio.iniap.gob.ec/items/d8f40fcd-d2ae-44a3-9d2f-8adf443438df).
- Variedades mejoradas de la Sierra: 101, 102, 103, 111, 122, 124, 153, 180, 182 y 199; [Guía de cultivo de maíz del INIAP (2021)](https://repositorio.iniap.gob.ec/bitstream/41000/5796/1/GUIA%20CULTIVO%20DE%20MAIZ%202021-1.pdf).
- H-248 Soberano, híbrido de maíz blanco duro; [INIAP](https://www.iniap.gob.ec/nuevo-maiz-iniap-soberano-presenta-caracteristicas-aptas-para-la-agroindustria/).
- INIAP 528, maíz blanco de calidad proteínica para choclo; [repositorio INIAP](https://repositorio.iniap.gob.ec/items/409cd20b-b9aa-4a56-8238-af093001fe04).
- INIAP 192 Chulpi e INIAP 193 Crocantito; [INIAP 192](https://repositorio.iniap.gob.ec/items/8d11905d-00c7-471b-a92e-b51334a561c0) e [INIAP 193](https://repositorio.iniap.gob.ec/items/65000718-4661-470b-8509-509dec32c62a).
- INIAP 198 Canguil, maíz duro blanco tipo reventón; [repositorio INIAP](https://repositorio.iniap.gob.ec/items/957a4a4d-d16c-40e7-8d1c-6f103e0c143d).
- H-602, H-824 Lojanito y los comerciales Trueno y Triunfo aparecen en ensayos de adaptación del INIAP; [informe técnico INIAP](https://repositorio.iniap.gob.ec/server/api/core/bitstreams/ec371377-a0bd-4049-9b75-950c74bd822e/content).
- Híbridos comerciales evaluados en Ecuador junto con H-248 y materiales INIAP; [INIAP / repositorio](https://repositorio.iniap.gob.ec/items/36e296b6-e108-4891-b145-3f7a2e68ecf3).

Se retiraron nombres cuya categoría anterior no correspondía al tipo de grano o que no tenían respaldo oficial suficiente para aparecer como opciones predefinidas. No se modifican los registros de parcelas ya guardados.
