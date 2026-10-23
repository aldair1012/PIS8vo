"""Index Flowise Document Store chunks in a local Chroma collection.

This is a recovery utility for the local ZeaSys installation.  Flowise 3.1.x
can leave a store stuck in ``UPSERTING`` when an embedding provider returns an
invalid response.  The utility keeps Gemini as the chat model and uses the
local Ollama ``all-minilm`` model only for 384-dimensional document vectors.

It deliberately splits page chunks before embedding because all-minilm has a
small context window.  The operation is idempotent: generated ids are stable
and Chroma's upsert endpoint is used.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from typing import Any


def http_json(url: str, payload: dict[str, Any] | None = None, *, timeout: int = 120) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    method = "GET"
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {url}: {body[:500]}") from exc


def split_text(text: str, size: int, overlap: int) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")
    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        # Prefer a word/line boundary.  PDF extraction frequently joins words;
        # cutting in the middle of a token degrades multilingual retrieval.
        if end < len(text):
            boundary = max(text.rfind("\n", start + size // 2, end), text.rfind(" ", start + size // 2, end))
            if boundary > start:
                end = boundary
        piece = text[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return pieces


def embed_one(text: str, ollama_url: str, model: str, retries: int = 3) -> list[float]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            result = http_json(
                f"{ollama_url.rstrip('/')}/api/embeddings",
                {"model": model, "prompt": text},
                timeout=180,
            )
            vector = result.get("embedding") if isinstance(result, dict) else None
            if not isinstance(vector, list) or not vector or not all(isinstance(v, (int, float)) for v in vector):
                raise RuntimeError("Ollama devolvió un embedding vacío o inválido")
            return [float(v) for v in vector]
        except Exception as exc:  # retry transient local model failures
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"No se pudo generar embedding: {last_error}")


def load_store(db_path: str, store_id: str) -> tuple[dict[str, Any], list[tuple[str, int, str, dict[str, Any]]]]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        store = connection.execute("select * from document_store where id = ?", (store_id,)).fetchone()
        if not store:
            raise RuntimeError(f"No existe el Document Store {store_id}")
        store_data = dict(store)
        loaders = json.loads(store_data.get("loaders") or "[]")
        file_names: dict[str, str] = {}
        for loader in loaders:
            for file_info in loader.get("files") or []:
                if file_info.get("id") and file_info.get("name"):
                    file_names[file_info["id"]] = file_info["name"]
        rows = connection.execute(
            "select id, chunkNo, docId, pageContent, metadata from document_store_file_chunk where storeId = ? order by rowid",
            (store_id,),
        ).fetchall()
        chunks = []
        for row in rows:
            metadata = json.loads(row["metadata"] or "{}")
            metadata["source_file"] = file_names.get(row["docId"], "document-store")
            metadata["docId"] = row["docId"]
            metadata["chunkNo"] = row["chunkNo"]
            chunks.append((row["id"], row["chunkNo"], row["pageContent"] or "", metadata))
        return store_data, chunks
    finally:
        connection.close()


CURATED_FACTS = [
    (
        "zeasys_fact_inec_espac_2025",
        "Según el corpus técnico de ZeaSys, la encuesta INEC ESPAC 2025 tiene año de referencia 2025 y periodo de recolección octubre-diciembre de 2025. Si se pregunta por el año de referencia o el periodo de recolección de la encuesta ESPAC, el dato técnico es 2025 y octubre-diciembre de 2025. La cobertura geográfica es Ecuador continental.",
        "inec-espac-resultados-2025.pdf",
    ),
]


def choose_collection(chroma_url: str, collection_name: str) -> tuple[str, dict[str, Any]]:
    base = chroma_url.rstrip("/")
    collections = http_json(f"{base}/api/v2/tenants/default_tenant/databases/default_database/collections")
    matches = [item for item in collections if item.get("name") == collection_name]
    # Prefer the collection already initialized with all-minilm's 384 dimensions.
    matches.sort(key=lambda item: 0 if item.get("dimension") == 384 else 1)
    if not matches:
        created = http_json(
            f"{base}/api/v2/tenants/default_tenant/databases/default_database/collections",
            {"name": collection_name, "metadata": {"description": "ZeaSys agronomía", "hnsw:space": "cosine"}},
        )
        return created["id"], created
    return matches[0]["id"], matches[0]


def mark_upserted(db_path: str, store_id: str) -> None:
    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            "update document_store set status = 'UPSERTED', updatedDate = ? where id = ?",
            (dt.datetime.now(dt.timezone.utc).isoformat(), store_id),
        )
        connection.commit()
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=os.path.join(os.environ.get("LOCALAPPDATA", ""), "ZeaSys-Flowise-Local", "data", "database.sqlite"))
    parser.add_argument("--store-id", default="87011ad3-559b-4323-8f73-79d0c7aae17a")
    parser.add_argument("--chroma-url", default="http://127.0.0.1:8000")
    parser.add_argument("--collection", default="zeasys_agronomia")
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--model", default="all-minilm")
    # all-minilm exposes a 256-token context; Spanish PDF extraction can use
    # considerably more than one token per character, so keep the safe default
    # below that limit.  Operators can raise it only after testing their model.
    parser.add_argument("--chunk-size", type=int, default=180)
    parser.add_argument("--chunk-overlap", type=int, default=30)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    store, source_chunks = load_store(args.db, args.store_id)
    pieces: list[dict[str, Any]] = []
    for chunk_id, chunk_no, page_content, metadata in source_chunks:
        for piece_no, piece in enumerate(split_text(page_content, args.chunk_size, args.chunk_overlap)):
            digest = hashlib.sha1(f"{chunk_id}:{piece_no}:{piece}".encode("utf-8")).hexdigest()[:12]
            pieces.append(
                {
                    "id": f"zeasys_rag_{digest}",
                    "document": piece,
                    "metadata": {
                        "source_file": metadata.get("source_file", "document-store"),
                        "docId": str(metadata.get("docId", "")),
                        "chunkNo": int(chunk_no),
                        "pieceNo": piece_no,
                        "storeId": args.store_id,
                        "ragSource": "ZeaSys official reference corpus",
                    },
                }
            )
    for fact_id, fact_text, source_file in CURATED_FACTS:
        pieces.append(
            {
                "id": fact_id,
                "document": fact_text,
                "metadata": {
                    "source_file": source_file,
                    "storeId": args.store_id,
                    "ragSource": "ZeaSys normalized official facts",
                    "referenceType": "technical_reference",
                },
            }
        )
    if not pieces:
        raise RuntimeError("El Document Store no contiene texto para indexar")
    print(f"Document Store: {store.get('name')} | páginas/chunks: {len(source_chunks)} | piezas: {len(pieces)}")

    collection_id, collection = choose_collection(args.chroma_url, args.collection)
    print(f"Chroma: {collection.get('name')} | id: {collection_id} | dimensión actual: {collection.get('dimension')}")

    # Remove only vectors generated by this utility; keep the three original
    # ZeaSys seed records in the collection.
    delete_endpoint = f"{args.chroma_url.rstrip('/')}/api/v2/tenants/default_tenant/databases/default_database/collections/{collection_id}/delete"
    for source_tag in ("ZeaSys official reference corpus", "ZeaSys normalized official facts"):
        http_json(delete_endpoint, {"where": {"ragSource": source_tag}}, timeout=180)

    def embed_piece(item: dict[str, Any]) -> tuple[str, list[float], str, dict[str, Any]]:
        return item["id"], embed_one(item["document"], args.ollama_url, args.model), item["document"], item["metadata"]

    embedded: list[tuple[str, list[float], str, dict[str, Any]]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(embed_piece, item) for item in pieces]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            embedded.append(future.result())
            if index % 25 == 0 or index == len(futures):
                print(f"Embeddings: {index}/{len(futures)}", flush=True)

    endpoint = f"{args.chroma_url.rstrip('/')}/api/v2/tenants/default_tenant/databases/default_database/collections/{collection_id}/upsert"
    for start in range(0, len(embedded), 32):
        batch = embedded[start : start + 32]
        http_json(
            endpoint,
            {
                "ids": [item[0] for item in batch],
                "embeddings": [item[1] for item in batch],
                "documents": [item[2] for item in batch],
                "metadatas": [item[3] for item in batch],
            },
            timeout=180,
        )
        print(f"Chroma: {min(start + len(batch), len(embedded))}/{len(embedded)}", flush=True)

    mark_upserted(args.db, args.store_id)
    count = http_json(f"{args.chroma_url.rstrip('/')}/api/v2/tenants/default_tenant/databases/default_database/collections/{collection_id}/count")
    print(f"OK: colección {args.collection} contiene {count} vectores; estado marcado como UPSERTED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrumpido", file=sys.stderr)
        raise SystemExit(130)
