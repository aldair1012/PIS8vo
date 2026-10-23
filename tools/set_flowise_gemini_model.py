"""Switch the local ZeaSys chatflow to an available Gemini model."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import sqlite3


CHATFLOW_ID = "27d477e0-66b5-4a51-aba0-dcfaf80728c1"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=os.path.join(os.environ.get("LOCALAPPDATA", ""), "ZeaSys-Flowise-Local", "data", "database.sqlite"))
    # Gemini 2.0 Flash Lite fue retirado por Google. Mantener aquí el modelo
    # vigente evita que una ejecución de mantenimiento vuelva a degradar el
    # chatflow a un modelo que responde 404.
    parser.add_argument("--model", default="gemini-3.5-flash-lite")
    args = parser.parse_args()
    backup = f"{args.db}.before-model-switch-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.bak"
    shutil.copy2(args.db, backup)
    connection = sqlite3.connect(args.db)
    try:
        row = connection.execute("select flowData from chat_flow where id = ?", (CHATFLOW_ID,)).fetchone()
        if not row:
            raise RuntimeError(f"No existe el chatflow {CHATFLOW_ID}")
        flow = json.loads(row[0])
        gemini = next(node for node in flow["nodes"] if node.get("id") == "chatGoogleGenerativeAI_0")
        gemini["data"]["inputs"]["modelName"] = args.model
        gemini["data"]["inputs"]["temperature"] = "0.2"
        gemini["data"]["inputs"]["maxOutputTokens"] = "700"
        connection.execute(
            "update chat_flow set flowData = ?, updatedDate = ? where id = ?",
            (json.dumps(flow, ensure_ascii=False, separators=(",", ":")), dt.datetime.now(dt.timezone.utc).isoformat(), CHATFLOW_ID),
        )
        connection.commit()
        print(json.dumps({"model": args.model, "backup": backup}, ensure_ascii=False))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
