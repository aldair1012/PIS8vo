"""Configure the local ZeaSys Flowise chatflow to use xAI Grok.

Flowise stores the chatflow graph as JSON inside SQLite.  The ChatXAI node
created from the UI leaves `modelName` empty, so the prediction endpoint fails
with HTTP 500 even though the credential is valid.  This migration sets a real
model, disables token streaming (the ZeaSys backend expects one JSON answer),
caps the output, validates the RAG graph and creates a timestamped backup.

It is idempotent and keeps the previous Gemini node as an unconnected fallback.
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
DEFAULT_MODEL = "grok-4.7"


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


def edge(source: str, source_handle: str, target: str, target_handle: str, suffix: str) -> dict[str, Any]:
    return {
        "source": source,
        "sourceHandle": source_handle,
        "target": target,
        "targetHandle": target_handle,
        "type": "buttonedge",
        "id": f"{source}-to-{target}-{suffix}",
    }


def ensure_edge(
    flow: dict[str, Any],
    source: str,
    source_handle: str,
    target: str,
    target_handle: str,
    suffix: str,
) -> bool:
    """Return True when the edge was added or repaired."""
    for current in flow.get("edges", []):
        if current.get("source") == source and current.get("target") == target and current.get("targetHandle") == target_handle:
            changed = current.get("sourceHandle") != source_handle
            current["sourceHandle"] = source_handle
            return changed
    flow.setdefault("edges", []).append(edge(source, source_handle, target, target_handle, suffix))
    return True


def migrate(db_path: str, chatflow_id: str, model: str) -> None:
    backup = f"{db_path}.before-grok-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.bak"
    shutil.copy2(db_path, backup)

    connection = sqlite3.connect(db_path)
    try:
        row = connection.execute("select flowData from chat_flow where id = ?", (chatflow_id,)).fetchone()
        if not row:
            raise RuntimeError(f"No existe el chatflow {chatflow_id}")

        flow = json.loads(row[0])
        grok = find_node(flow, "ChatXAI")
        memory = find_node(flow, "ConversationSummaryBufferMemory")
        store = find_node(flow, "DocumentStoreVS")
        qa = find_node(flow, "ConversationalRetrievalQAChain")

        inputs = grok["data"].setdefault("inputs", {})
        inputs["modelName"] = model
        inputs["temperature"] = "0.2"
        inputs["streaming"] = False
        inputs["maxTokens"] = "1200"
        inputs["allowImageUploads"] = False

        grok_handle = output_handle(grok, "BaseChatModel")
        memory_handle = output_handle(memory, "BaseMemory")
        store_handle = output_handle(store, "BaseRetriever")

        model_targets = {
            "conversationSummaryBufferMemory_0-input-model-BaseChatModel",
            "conversationalRetrievalQAChain_0-input-model-BaseChatModel",
        }
        # Drop model edges from a previous provider (for example Gemini) so the
        # QA chain has exactly one active chat model.
        flow["edges"] = [
            current
            for current in flow.get("edges", [])
            if not (current.get("targetHandle") in model_targets and current.get("source") != grok["id"])
        ]

        changed = [
            ensure_edge(flow, grok["id"], grok_handle, memory["id"], f"{memory['id']}-input-model-BaseChatModel", "memory-model"),
            ensure_edge(flow, grok["id"], grok_handle, qa["id"], f"{qa['id']}-input-model-BaseChatModel", "qa-model"),
            ensure_edge(flow, memory["id"], memory_handle, qa["id"], f"{qa['id']}-input-memory-BaseMemory", "qa-memory"),
            ensure_edge(flow, store["id"], store_handle, qa["id"], f"{qa['id']}-input-vectorStoreRetriever-BaseRetriever", "qa-retriever"),
        ]

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
                    "model": model,
                    "streaming": False,
                    "maxTokens": 1200,
                    "edges": len(flow.get("edges", [])),
                    "edgesAddedOrRepaired": sum(changed),
                    "activeModelNode": grok["id"],
                    "orphanGeminiNode": any(node.get("data", {}).get("type") == "ChatGoogleGenerativeAI" for node in flow.get("nodes", [])),
                },
                ensure_ascii=False,
            )
        )
    finally:
        connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=os.path.join(os.environ.get("LOCALAPPDATA", ""), "ZeaSys-Flowise-Local", "data", "database.sqlite"))
    parser.add_argument("--chatflow-id", default=DEFAULT_CHATFLOW_ID)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()
    migrate(args.db, args.chatflow_id, args.model)
