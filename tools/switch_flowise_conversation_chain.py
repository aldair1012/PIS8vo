"""Convierte el chatflow de ZeaSys en una Conversation Chain sin RAG.

El chat combinado necesita enviar clima, precio, nutrición, rendimiento y
finanzas en un solo mensaje. La cadena RAG original intenta embeber ese
mensaje completo con Ollama/all-minilm y falla con:

    the input length exceeds the context length

La Conversation Chain usa Gemini + memoria y recibe el contexto directamente,
sin embeddings. El nodo RAG, el almacén vectorial y el nodo de Grok se retiran
del lienzo; el respaldo de SQLite conserva la versión anterior y el chatflow
RAG puede recrearse desde ese respaldo si se necesita.

Uso:
    python tools/switch_flowise_conversation_chain.py
    python tools/switch_flowise_conversation_chain.py --model gemini-3.5-flash-lite
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import sqlite3
from typing import Any


DEFAULT_CHATFLOW_ID = "27d477e0-66b5-4a51-aba0-dcfaf80728c1"
DEFAULT_MODEL = "gemini-3.5-flash-lite"

SYSTEM_PROMPT = """Eres el asistente agrícola de ZeaSys. Respondes en español claro, natural, directo y concreto. El mensaje del usuario contiene su pregunta y un bloque "Contexto autorizado de ZeaSys" con datos de la parcela, clima, precio, nutrición, rendimiento, finanzas y simulaciones.

Estilo de respuesta:
- Responde únicamente lo que se preguntó. No agregues datos, secciones, recomendaciones, advertencias, fuentes ni fechas que el usuario no haya pedido.
- Empieza con la respuesta directa. Una pregunta simple se responde en una o dos frases; una pregunta de análisis, en un párrafo de máximo cuatro frases.
- No uses encabezados fijos ni plantillas como "Conclusión directa", "Impacto en el cultivo", "Datos del Dashboard" o "Acciones requeridas".
- Usa listas sólo si el usuario pide una lista, una comparación o pasos concretos. No conviertas toda la respuesta en bullets.
- Cita sólo las cifras necesarias para sostener la respuesta. No enumeres el contexto disponible ni repitas la misma cifra en varias secciones.
- Ante una recomendación amplia ("todas las variables", "qué hago"), elige los dos o tres factores agronómicos que más cambian la decisión y da una acción principal. No enumeres el contexto ni incluyas precio, margen, impacto de precio, fuentes ni cálculos financieros, salvo que la pregunta los pida explícitamente.
- No menciones claves internas del contexto (precio_maiz, impacto_precio, simulacion_borrador, campos_faltantes, etc.). Traduce todo a lenguaje natural.
- No cierres con ofertas genéricas como "¿quieres que profundice?". La interfaz muestra botones para pedir más detalle.
- Si el usuario pide más detalle, amplía la respuesta anterior con razonamiento y cifras concretas, sin volver a la plantilla.
- En saludos o preguntas generales, responde sólo el saludo o la aclaración; no enumeres parcelas ni cifras.

Reglas de datos:
- No inventes cifras, unidades, fechas, porcentajes, dosis, diagnósticos ni resultados de simulaciones.
- Si falta el dato que se pide, dilo en una frase; no lo completes con supuestos ni enumeres otros datos faltantes.
- Conserva el nombre de la parcela y las unidades exactamente como aparecen.
- Distingue observación, pronóstico, promedio de 30 días, referencia de precio y simulación guardada sólo cuando la respuesta lo necesite. No lo declares por rutina.
- Respeta las unidades del contexto: rendimiento_predicho en t/ha; produccion_total_qq y delta_por_qq en qq; margen_neto_por_ha en USD/ha; superficies en ha. No cambies una unidad por otra.
- No conviertas acumulados anuales a periodos más cortos ni atribuyas causalidad sin una simulación comparable.
- No ejecutes simulaciones nuevas ni modifiques registros: sólo lees las simulaciones guardadas y el contexto autorizado.
- No menciones Flowise, Chroma, Ollama, RAG, prompts, embeddings ni fuentes internas. Habla como el asistente de ZeaSys.

Precio del maíz:
- El bloque precio_maiz es una referencia oficial, no una cotización de mercado en tiempo real. Si la pregunta es de precio, acláralo en una frase breve.
- Menciona fuente, fecha, piso, techo o promedio sólo si el usuario pregunta por ellos.
- Si la pregunta trata de margen, ingreso, rentabilidad o "cómo afecta el precio" y existe impacto_precio, usa delta_por_qq y delta_ingreso_estimado con la producción indicada; no sustituyas ese cálculo por el margen actual.
- Explica el efecto en una o dos frases y aclara que es un cálculo mecánico que no descuenta cambios de costos ni penalizaciones por calidad.

Clima:
- clima.actual es una observación de corto plazo; clima.pronostico_7d es una estimación y clima.promedio_30d es el promedio observado de los últimos 30 días.
- Entrega sólo el bloque que la pregunta necesita. No presentes el promedio de 30 días como el clima de hoy ni el pronóstico como una certeza.
- En promedio_30d, temperatura_c y humedad_pct son promedios de 30 días; precipitacion_30d_mm es el acumulado real y precipitacion_anual_estimada_mm es una proyección anual. No etiquetes la proyección anual como lluvia de 30 días.

Nutrición y "vitaminas":
- Si el productor pregunta por "vitaminas", aclara en una frase que son nutrientes vegetales (nitrógeno, fósforo, potasio y micronutrientes), no vitaminas de uso humano.
- nutricion es una orientación, no una prescripción. No indiques dosis de P, K ni micronutrientes sin análisis de suelo.
- Para nitrógeno, indica el rango orientativo y pide validarlo con análisis de suelo y asistencia técnica local.
- No inventes productos comerciales, mezclas ni calendarios de aplicación.
- Si la simulación guardada trae una recomendación, atribúyela a esa simulación y no la generalices a otras parcelas.

Simulación en edición:
- Si el contexto incluye simulacion_borrador, es la fuente principal para la simulación actual. Úsalo para clima de entrada, pH, textura, área y fertilizante en lugar de los valores guardados de la parcela cuando haya conflicto.
- El borrador refleja el formulario de Nueva Simulación y no es una simulación ejecutada ni un resultado calculado. No afirmes que el rendimiento ya fue calculado.
- Conserva el nombre de la parcela del borrador. No respondas con otra parcela aunque aparezca en conversaciones anteriores.
- Si aparece simulacion_reciente, es una simulación guardada anterior de la misma parcela; identifícala como anterior.
- Si campos_faltantes impide responder, pide completar sólo esos datos; no inventes sus valores.
- Para fertilizante, distingue fertilizante_n_entrada_kg_ha (lo que el usuario escribió) de la orientación de nutricion. No inventes dosis de P, K ni micronutrientes.
- Si no hay simulacion_borrador ni parcela activa, pide seleccionar una parcela antes de responder sobre una simulación.

Memoria guardada:
- conversaciones_favoritas contiene conversaciones que el productor guardó. Sólo llega cuando la pregunta se refiere a ellas, a lo hablado antes o pide recordar algo; no las menciones por iniciativa propia.
- No repitas literalmente una conversación guardada: extrae el dato o la conclusión que responda la pregunta actual.

Fuentes:
- No incluyas "Fuente:", nombres de proveedores, URLs ni fechas por defecto.
- Si el usuario pide fuente, origen, fecha o confiabilidad, responde con la fuente disponible en el contexto para el dato consultado; si no está, dilo sin inventarla."""


def find_node(flow: dict[str, Any], node_type: str) -> dict[str, Any]:
    for node in flow.get("nodes", []):
        if node.get("data", {}).get("type") == node_type:
            return node
    raise RuntimeError(f"El chatflow no contiene un nodo {node_type}")


def output_handle(node: dict[str, Any], base_class: str) -> str:
    for anchor in node.get("data", {}).get("outputAnchors", []):
        if base_class in anchor.get("type", ""):
            return anchor["id"]
    raise RuntimeError(f"El nodo {node.get('id')} no expone una salida {base_class}")


def ensure_edge(
    flow: dict[str, Any],
    source: str,
    source_handle: str,
    target: str,
    target_handle: str,
    suffix: str,
) -> None:
    for current in flow.get("edges", []):
        if (
            current.get("source") == source
            and current.get("target") == target
            and current.get("targetHandle") == target_handle
        ):
            current["sourceHandle"] = source_handle
            return

    flow.setdefault("edges", []).append(
        {
            "source": source,
            "sourceHandle": source_handle,
            "target": target,
            "targetHandle": target_handle,
            "type": "buttonedge",
            "id": f"{source}-to-{target}-{suffix}",
        }
    )


def build_conversation_chain(
    qa: dict[str, Any], gemini_id: str, memory_id: str, components_dir: str
) -> dict[str, Any]:
    position = qa.get("position", {"x": 36.0, "y": 475.0})
    position_absolute = qa.get("positionAbsolute", position)
    node_id = "conversationChain_0"
    base = os.path.join(components_dir, "chains", "ConversationChain")

    return {
        "id": node_id,
        "position": position,
        "type": "customNode",
        "data": {
            "label": "Conversation Chain",
            "name": "conversationChain",
            "version": 3,
            "type": "ConversationChain",
            "icon": os.path.join(base, "conv.svg"),
            "category": "Chains",
            "description": "Chat models specific conversational chain with memory",
            "baseClasses": ["ConversationChain", "BaseChain", "Runnable"],
            "inputs": {
                "model": f"{{{{{gemini_id}.data.instance}}}}",
                "memory": f"{{{{{memory_id}.data.instance}}}}",
                "systemMessagePrompt": SYSTEM_PROMPT,
            },
            "outputs": {},
            "inputAnchors": [
                {
                    "label": "Chat Model",
                    "name": "model",
                    "type": "BaseChatModel",
                    "id": f"{node_id}-input-model-BaseChatModel",
                    "display": True,
                },
                {
                    "label": "Memory",
                    "name": "memory",
                    "type": "BaseMemory",
                    "id": f"{node_id}-input-memory-BaseMemory",
                    "display": True,
                },
            ],
            "inputParams": [
                {
                    "label": "System Message",
                    "name": "systemMessagePrompt",
                    "type": "string",
                    "rows": 4,
                    "additionalParams": True,
                    "optional": True,
                    "id": f"{node_id}-input-systemMessagePrompt-string",
                    "display": True,
                }
            ],
            "outputAnchors": [
                {
                    "id": f"{node_id}-output-conversationChain-ConversationChain|BaseChain|Runnable",
                    "name": "conversationChain",
                    "label": "Conversation Chain",
                    "description": "",
                    "type": "ConversationChain | BaseChain | Runnable",
                }
            ],
            "selected": False,
            "filePath": os.path.join(base, "ConversationChain.js"),
        },
        "width": 300,
        "height": 500,
        "positionAbsolute": position_absolute,
        "selected": False,
        "dragging": False,
    }


def migrate(
    db_path: str,
    chatflow_id: str,
    model: str,
    max_tokens: int,
    components_dir: str,
) -> None:
    backup = f"{db_path}.before-conversation-chain-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.bak"
    shutil.copy2(db_path, backup)

    connection = sqlite3.connect(db_path)
    try:
        row = connection.execute(
            "select flowData from chat_flow where id = ?", (chatflow_id,)
        ).fetchone()
        if not row:
            raise RuntimeError(f"No existe el chatflow {chatflow_id}")

        flow = json.loads(row[0])
        gemini = find_node(flow, "ChatGoogleGenerativeAI")
        memory = find_node(flow, "ConversationSummaryBufferMemory")

        gemini_inputs = gemini["data"].setdefault("inputs", {})
        gemini_inputs.update(
            {
                "modelName": model,
                "temperature": "0.2",
                "streaming": False,
                "maxOutputTokens": str(max_tokens),
                "allowImageUploads": False,
            }
        )

        chain = next(
            (
                node
                for node in flow.get("nodes", [])
                if node.get("data", {}).get("type") == "ConversationChain"
            ),
            None,
        )
        removed_types: set[str] = set()
        if chain is None:
            qa = find_node(flow, "ConversationalRetrievalQAChain")
            chain = build_conversation_chain(
                qa, gemini["id"], memory["id"], components_dir
            )
            # El lienzo principal queda con un solo nodo terminal: la cadena
            # conversacional. Los nodos RAG y xAI se conservan en el respaldo.
            removed_types = {
                "ConversationalRetrievalQAChain",
                "DocumentStoreVS",
                "ChatXAI",
            }
        else:
            chain["data"].setdefault("inputs", {}).update(
                {
                    "model": f"{{{{{gemini['id']}.data.instance}}}}",
                    "memory": f"{{{{{memory['id']}.data.instance}}}}",
                    "systemMessagePrompt": SYSTEM_PROMPT,
                }
            )

        chain_id = chain["id"]
        removed_ids = {
            node["id"]
            for node in flow.get("nodes", [])
            if node.get("data", {}).get("type") in removed_types
        }
        if removed_types:
            flow["nodes"] = [
                node
                for node in flow.get("nodes", [])
                if node.get("data", {}).get("type") not in removed_types
            ]
            if chain not in flow["nodes"]:
                flow["nodes"].append(chain)
            flow["edges"] = [
                edge
                for edge in flow.get("edges", [])
                if edge.get("source") not in removed_ids
                and edge.get("target") not in removed_ids
            ]

        gemini_handle = output_handle(gemini, "BaseChatModel")
        memory_handle = output_handle(memory, "BaseMemory")
        ensure_edge(
            flow,
            gemini["id"],
            gemini_handle,
            memory["id"],
            f"{memory['id']}-input-model-BaseChatModel",
            "conversation-memory-model",
        )
        ensure_edge(
            flow,
            gemini["id"],
            gemini_handle,
            chain_id,
            f"{chain_id}-input-model-BaseChatModel",
            "conversation-chain-model",
        )
        ensure_edge(
            flow,
            memory["id"],
            memory_handle,
            chain_id,
            f"{chain_id}-input-memory-BaseMemory",
            "conversation-chain-memory",
        )

        memory["data"].setdefault("inputs", {})["model"] = (
            f"{{{{{gemini['id']}.data.instance}}}}"
        )

        connection.execute(
            "update chat_flow set flowData = ?, updatedDate = ?, deployed = 1 where id = ?",
            (
                json.dumps(flow, ensure_ascii=False, separators=(",", ":")),
                dt.datetime.now(dt.timezone.utc).isoformat(),
                chatflow_id,
            ),
        )
        connection.commit()

        print(
            json.dumps(
                {
                    "backup": backup,
                    "chatflow": chatflow_id,
                    "activeNode": chain_id,
                    "model": model,
                    "maxOutputTokens": max_tokens,
                    "nodes": len(flow.get("nodes", [])),
                    "edges": len(flow.get("edges", [])),
                    "removedNodes": sorted(removed_ids),
                },
                ensure_ascii=False,
            )
        )
    finally:
        connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        default=os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "ZeaSys-Flowise-Local",
            "data",
            "database.sqlite",
        ),
    )
    parser.add_argument("--chatflow-id", default=DEFAULT_CHATFLOW_ID)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--max-tokens", type=int, default=1200)
    parser.add_argument(
        "--components-dir",
        default=os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "ZeaSys-Flowise-Local",
            "node_modules",
            "flowise-components",
            "dist",
            "nodes",
        ),
        help="Directorio dist/nodes de flowise-components",
    )
    args = parser.parse_args()
    migrate(
        args.db,
        args.chatflow_id,
        args.model,
        args.max_tokens,
        args.components_dir,
    )
