"""Activa Gemini en el chatflow local de ZeaSys y retira el modelo xAI.

El chatflow conserva el nodo de Grok como referencia, pero sólo el nodo de
Gemini queda conectado a la memoria y a la cadena QA. La migración es
idempotente, crea un respaldo con marca de tiempo y actualiza el prompt de
respuesta con las reglas de clima, precio de referencia y nutrición.

Uso:
    python tools/switch_flowise_gemini.py
    python tools/switch_flowise_gemini.py --model gemini-3.5-flash-lite
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

REGLAS_ADICIONALES = """

Reglas específicas del contexto agrícola combinado:
- El bloque precio_maiz es una franja oficial de referencia del MAGP, no una cotización de mercado en tiempo real. Cita la fuente y la fecha; aclara que el precio efectivo puede variar por calidad, humedad, intermediarios y mercado local.
- El bloque clima.actual es una observación de corto plazo y clima.pronostico_7d es una estimación. clima.promedio_30d es climatología histórica: no lo presentes como el clima de hoy.
- El bloque nutricion es orientación de catálogo. No prescribas dosis de P, K ni micronutrientes sin análisis de suelo. Para nitrógeno, indica la recomendación del catálogo y pide validarla con análisis y asistencia técnica local.
- El contexto_agricola ya combina clima, precio, rendimiento, finanzas y la simulación más reciente. Úsalo aunque el panel visible sea otro y no digas que un dato no está disponible si aparece en ese bloque.
- Si el productor pregunta por "vitaminas", aclara que se refiere a nutrientes vegetales (N, P, K y micronutrientes), no a vitaminas de uso humano.
"""


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
) -> bool:
    for current in flow.get("edges", []):
        if (
            current.get("source") == source
            and current.get("target") == target
            and current.get("targetHandle") == target_handle
        ):
            changed = current.get("sourceHandle") != source_handle
            current["sourceHandle"] = source_handle
            return changed

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
    return True


def migrate(db_path: str, chatflow_id: str, model: str, max_tokens: int) -> None:
    backup = f"{db_path}.before-gemini-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.bak"
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
        store = find_node(flow, "DocumentStoreVS")
        qa = find_node(flow, "ConversationalRetrievalQAChain")

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

        # El nodo de Grok puede seguir en el lienzo como referencia, pero no
        # debe alimentar ni la memoria ni la cadena QA.
        grok = next(
            (
                node
                for node in flow.get("nodes", [])
                if node.get("data", {}).get("type") == "ChatXAI"
            ),
            None,
        )
        if grok is not None:
            grok["data"].setdefault("inputs", {}).setdefault("streaming", False)

        model_targets = {
            f"{memory['id']}-input-model-BaseChatModel",
            f"{qa['id']}-input-model-BaseChatModel",
        }
        flow["edges"] = [
            current
            for current in flow.get("edges", [])
            if not (
                current.get("targetHandle") in model_targets
                and current.get("source") != gemini["id"]
            )
        ]

        gemini_handle = output_handle(gemini, "BaseChatModel")
        memory_handle = output_handle(memory, "BaseMemory")
        store_handle = output_handle(store, "BaseRetriever")

        ensure_edge(
            flow,
            gemini["id"],
            gemini_handle,
            memory["id"],
            f"{memory['id']}-input-model-BaseChatModel",
            "gemini-memory-model",
        )
        ensure_edge(
            flow,
            gemini["id"],
            gemini_handle,
            qa["id"],
            f"{qa['id']}-input-model-BaseChatModel",
            "gemini-qa-model",
        )
        ensure_edge(
            flow,
            memory["id"],
            memory_handle,
            qa["id"],
            f"{qa['id']}-input-memory-BaseMemory",
            "gemini-memory",
        )
        ensure_edge(
            flow,
            store["id"],
            store_handle,
            qa["id"],
            f"{qa['id']}-input-vectorStoreRetriever-BaseRetriever",
            "gemini-retriever",
        )

        memory["data"].setdefault("inputs", {})["model"] = f"{{{{{gemini['id']}.data.instance}}}}"
        qa_inputs = qa["data"].setdefault("inputs", {})
        qa_inputs["model"] = f"{{{{{gemini['id']}.data.instance}}}}"

        # El rephrase se embebe con Ollama/all-minilm. Si el modelo reformula
        # todo el contexto, el embedding supera su ventana y Flowise devuelve
        # "the input length exceeds the context length". La consulta de
        # recuperación debe ser breve; la pregunta original completa sigue
        # llegando al modelo generador.
        qa_inputs["rephrasePrompt"] = (
            "Reformula la pregunta de seguimiento como una consulta de búsqueda "
            "independiente en español, de máximo 25 palabras. Conserva sólo "
            "parcela, cultivo, etapa, fechas, periodo y unidades imprescindibles. "
            "No copies el contexto, no repitas cifras largas y no inventes datos.\n\n"
            "Historial:\n{chat_history}\n\n"
            "Pregunta:\n{question}\n\n"
            "Consulta breve:"
        )

        response_prompt = str(qa_inputs.get("responsePrompt", ""))
        if "Reglas específicas del contexto agrícola combinado" not in response_prompt:
            qa_inputs["responsePrompt"] = response_prompt.rstrip() + REGLAS_ADICIONALES

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
                    "activeModelNode": gemini["id"],
                    "model": model,
                    "maxOutputTokens": max_tokens,
                    "streaming": False,
                    "edges": len(flow.get("edges", [])),
                    "grokStillOnCanvas": grok is not None,
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
    args = parser.parse_args()
    migrate(args.db, args.chatflow_id, args.model, args.max_tokens)
