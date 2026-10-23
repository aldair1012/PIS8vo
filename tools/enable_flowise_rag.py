"""Wire the local ZeaSys Flowise chatflow to the indexed Document Store.

The Flowise UI stores a chatflow as JSON in SQLite.  This migration is used
when the local UI cannot reopen after a failed document-store upsert.  It is
idempotent and preserves the active chat model and summary memory nodes.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
from typing import Any


STORE_ID = "87011ad3-559b-4323-8f73-79d0c7aae17a"
CHATFLOW_ID = "27d477e0-66b5-4a51-aba0-dcfaf80728c1"
STORE_FILE = r"C:\Users\aldai\AppData\Local\ZeaSys-Flowise-Local\node_modules\flowise-components\dist\nodes\vectorstores\DocumentStoreVS\DocStoreVector.js"
QA_FILE = r"C:\Users\aldai\AppData\Local\ZeaSys-Flowise-Local\node_modules\flowise-components\dist\nodes\chains\ConversationalRetrievalQAChain\ConversationalRetrievalQAChain.js"


def node_shell(node_id: str, data: dict[str, Any], position: dict[str, float], width: int, height: int) -> dict[str, Any]:
    return {
        "id": node_id,
        "position": position,
        "type": "customNode",
        "data": data,
        "width": width,
        "height": height,
        "positionAbsolute": position,
        "selected": False,
    }


def document_store_node() -> dict[str, Any]:
    node_id = "documentStoreVS_0"
    data = {
        "label": "Document Store (Vector)",
        "name": "documentStoreVS",
        "version": 1,
        "type": "DocumentStoreVS",
        "icon": "C:/Users/aldai/AppData/Local/ZeaSys-Flowise-Local/node_modules/flowise-components/dist/nodes/vectorstores/DocumentStoreVS/dstore.svg",
        "category": "Vector Stores",
        "description": "Search and retrieve documents from Document Store",
        "baseClasses": ["DocumentStoreVS"],
        "inputs": {"selectedStore": STORE_ID},
        "outputs": {"output": "retriever"},
        "inputAnchors": [
            {
                "label": "Select Store",
                "name": "selectedStore",
                "type": "asyncOptions",
                "loadMethod": "listStores",
                "id": f"{node_id}-input-selectedStore-asyncOptions",
                "display": True,
            }
        ],
        "inputParams": [
            {
                "label": "Select Store",
                "name": "selectedStore",
                "type": "asyncOptions",
                "loadMethod": "listStores",
                "id": f"{node_id}-input-selectedStore-asyncOptions",
                "display": True,
            }
        ],
        "outputAnchors": [
            {
                "id": f"{node_id}-output-retriever-BaseRetriever",
                "name": "retriever",
                "label": "Retriever",
                "description": "",
                "type": "BaseRetriever",
            },
            {
                "id": f"{node_id}-output-vectorStore-VectorStore",
                "name": "vectorStore",
                "label": "Vector Store",
                "description": "",
                "type": "VectorStore",
            },
        ],
        "selected": False,
        "dragging": False,
        "filePath": STORE_FILE,
    }
    return node_shell(node_id, data, {"x": -335, "y": 120}, 300, 250)


def qa_node(model_id: str) -> dict[str, Any]:
    node_id = "conversationalRetrievalQAChain_0"
    rephrase = (
        "Reformula la pregunta de seguimiento como una pregunta independiente. "
        "Conserva parcela, cultivo, etapa, fechas y unidades.\n\n"
        "Historial:\n{chat_history}\n\nPregunta:\n{question}\n\nPregunta independiente:"
    )
    response = (
        "Eres el asistente agrícola de ZeaSys. Responde en español, de forma natural, directa y concisa. "
        "El contexto entre <doc> contiene referencias técnicas e históricas; úsalo sólo si es pertinente. "
        "Los datos actuales del dashboard, APIs y simulaciones que aparecen en la pregunta tienen prioridad sobre "
        "cualquier valor histórico. No inventes cifras, unidades, fechas, porcentajes, dosis ni diagnósticos. "
        "Distingue datos observados, históricos, pronósticos, estimaciones y valores teóricos. Conserva el nombre "
        "de la parcela y las unidades. Si falta un dato actual solicitado del dashboard, escribe: No disponible en "
        "el dashboard. Si la pregunta pide explícitamente una guía, manual, ESPAC o referencia histórica, "
        "responde con el contexto documental recuperado y etiqueta el dato como Referencia técnica. "
        "No conviertas acumulados anuales en periodos más cortos ni atribuyas un porcentaje causal sin una simulación comparable. "
        "Devuelve sólo la respuesta para el productor, sin mencionar Flowise, Chroma, Ollama, RAG, prompts ni fuentes internas.\n\n"
        "Estructura cuando aporte valor:\n"
        "**Conclusión directa:** 1 a 3 frases.\n\n"
        "**Impacto en el cultivo**\n- Consecuencias relevantes y condicionadas.\n\n"
        "**Datos del Dashboard**\n- Sólo cifras explícitas, con fecha, periodo y unidad.\n\n"
        "**Acciones requeridas**\n1. De 2 a 4 pasos seguros y verificables.\n\n"
        "Omite secciones que no aporten. Las recomendaciones de insumos son orientación técnica: no inventes dosis y pide verificar la etiqueta y validar con un técnico local.\n\n"
        "Contexto documental:\n{context}"
    )
    data = {
        "label": "Conversational Retrieval QA Chain",
        "name": "conversationalRetrievalQAChain",
        "version": 3,
        "type": "ConversationalRetrievalQAChain",
        "icon": "C:/Users/aldai/AppData/Local/ZeaSys-Flowise-Local/node_modules/flowise-components/dist/nodes/chains/ConversationalRetrievalQAChain/qa.svg",
        "category": "Chains",
        "description": "Document QA - built on RetrievalQAChain to provide a chat history component",
        "baseClasses": ["ConversationalRetrievalQAChain", "BaseChain", "Runnable"],
        "inputs": {
            "model": f"{{{{{model_id}.data.instance}}}}",
            "vectorStoreRetriever": "{{documentStoreVS_0.data.instance}}",
            "memory": "{{conversationSummaryBufferMemory_0.data.instance}}",
            "returnSourceDocuments": False,
            "rephrasePrompt": rephrase,
            "responsePrompt": response,
            "inputModeration": "",
        },
        "outputs": {"output": "conversationalRetrievalQAChain"},
        "inputAnchors": [
            {"label": "Chat Model", "name": "model", "type": "BaseChatModel", "id": f"{node_id}-input-model-BaseChatModel", "display": True},
            {"label": "Vector Store Retriever", "name": "vectorStoreRetriever", "type": "BaseRetriever", "id": f"{node_id}-input-vectorStoreRetriever-BaseRetriever", "display": True},
            {"label": "Memory", "name": "memory", "type": "BaseMemory", "optional": True, "id": f"{node_id}-input-memory-BaseMemory", "display": True},
        ],
        "inputParams": [
            {"label": "Return Source Documents", "name": "returnSourceDocuments", "type": "boolean", "optional": True, "id": f"{node_id}-input-returnSourceDocuments-boolean", "display": True},
            {"label": "Rephrase Prompt", "name": "rephrasePrompt", "type": "string", "rows": 4, "additionalParams": True, "optional": True, "id": f"{node_id}-input-rephrasePrompt-string", "display": True},
            {"label": "Response Prompt", "name": "responsePrompt", "type": "string", "rows": 4, "additionalParams": True, "optional": True, "id": f"{node_id}-input-responsePrompt-string", "display": True},
        ],
        "outputAnchors": [
            {"id": f"{node_id}-output-conversationalRetrievalQAChain-ConversationalRetrievalQAChain|BaseChain|Runnable", "name": "conversationalRetrievalQAChain", "label": "Conversational Retrieval QA Chain", "description": "", "type": "ConversationalRetrievalQAChain | BaseChain | Runnable"},
            {"id": f"{node_id}-output-outputPrediction-string|json", "name": "outputPrediction", "label": "Output", "description": "", "type": "string | json"},
        ],
        "selected": False,
        "filePath": QA_FILE,
    }
    return node_shell(node_id, data, {"x": 180, "y": 240}, 330, 620)


def edge(source: str, source_handle: str, target: str, target_handle: str, suffix: str) -> dict[str, Any]:
    return {"source": source, "sourceHandle": source_handle, "target": target, "targetHandle": target_handle, "type": "buttonedge", "id": f"{source}-to-{target}-{suffix}"}


CHAT_MODEL_TYPES = {
    "ChatXAI",
    "ChatGoogleGenerativeAI",
    "ChatOpenAI",
    "ChatAnthropic",
    "ChatOllama",
    "ChatMistralAI",
    "ChatGroq",
}


def output_handle(node: dict[str, Any], base_class: str) -> str:
    for anchor in node.get("data", {}).get("outputAnchors", []):
        if base_class in anchor.get("type", ""):
            return anchor["id"]
    raise RuntimeError(f"El nodo {node.get('id')} no expone una salida {base_class}")


def active_chat_model(flow: dict[str, Any]) -> dict[str, Any]:
    """Prefer the model already referenced by the QA chain, then any chat model."""
    qa = next((node for node in flow.get("nodes", []) if node.get("data", {}).get("type") == "ConversationalRetrievalQAChain"), None)
    model_ref = qa.get("data", {}).get("inputs", {}).get("model", "") if qa else ""
    match = re.search(r"\{\{([^.}]+)\.data\.instance\}\}", model_ref)
    if match:
        for node in flow.get("nodes", []):
            if node.get("id") == match.group(1):
                return node
    for node in flow.get("nodes", []):
        if node.get("data", {}).get("type") in CHAT_MODEL_TYPES:
            return node
    raise RuntimeError("El chatflow no contiene un nodo de modelo de chat")


def migrate(db_path: str) -> None:
    backup = f"{db_path}.before-rag-flow-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.bak"
    shutil.copy2(db_path, backup)
    connection = sqlite3.connect(db_path)
    try:
        row = connection.execute("select flowData from chat_flow where id = ?", (CHATFLOW_ID,)).fetchone()
        if not row:
            raise RuntimeError(f"No existe el chatflow {CHATFLOW_ID}")
        flow = json.loads(row[0])
        chat_model = active_chat_model(flow)
        chat_model_id = chat_model["id"]
        chat_model_handle = output_handle(chat_model, "BaseChatModel")
        memory = next(node for node in flow.get("nodes", []) if node.get("data", {}).get("type") == "ConversationSummaryBufferMemory")
        memory_handle = output_handle(memory, "BaseMemory")
        nodes = [node for node in flow.get("nodes", []) if node.get("id") not in {"conversationChain_0", "chatPromptTemplate_0", "conversationalRetrievalQAChain_0", "documentStoreVS_0"}]
        nodes.extend([document_store_node(), qa_node(chat_model_id)])
        flow["nodes"] = nodes
        flow["edges"] = [
            edge(chat_model_id, chat_model_handle, "conversationSummaryBufferMemory_0", "conversationSummaryBufferMemory_0-input-model-BaseChatModel", "memory-model"),
            edge(chat_model_id, chat_model_handle, "conversationalRetrievalQAChain_0", "conversationalRetrievalQAChain_0-input-model-BaseChatModel", "qa-model"),
            edge("conversationSummaryBufferMemory_0", memory_handle, "conversationalRetrievalQAChain_0", "conversationalRetrievalQAChain_0-input-memory-BaseMemory", "qa-memory"),
            edge("documentStoreVS_0", "documentStoreVS_0-output-retriever-BaseRetriever", "conversationalRetrievalQAChain_0", "conversationalRetrievalQAChain_0-input-vectorStoreRetriever-BaseRetriever", "qa-retriever"),
        ]
        connection.execute("update chat_flow set flowData = ?, updatedDate = ? where id = ?", (json.dumps(flow, ensure_ascii=False, separators=(",", ":")), dt.datetime.now(dt.timezone.utc).isoformat(), CHATFLOW_ID))
        connection.commit()
        print(json.dumps({"backup": backup, "nodes": [node["id"] for node in nodes], "edges": len(flow["edges"])}, ensure_ascii=False))
    finally:
        connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=os.path.join(os.environ.get("LOCALAPPDATA", ""), "ZeaSys-Flowise-Local", "data", "database.sqlite"))
    args = parser.parse_args()
    migrate(args.db)
