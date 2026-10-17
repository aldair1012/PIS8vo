#!/usr/bin/env python
import sys
import json
import urllib.request

def fetch_precision_soil(lat, lon):
    try:
        url = f"https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&property=phh2o&property=clay&property=sand&property=silt&property=soc&depth=0-5cm&value=mean"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (AgroPredict/2.0)'})
        with urllib.request.urlopen(req, timeout=5.0) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        layers = data.get("properties", {}).get("layers", [])
        result = {}
        for layer in layers:
            name = layer.get("name")
            depths = layer.get("depths", [])
            if depths and depths[0].get("values"):
                val = depths[0]["values"].get("mean")
                if val is not None:
                    result[name] = float(val)

        mapped = {}
        if "phh2o" in result:
            mapped["ph"] = round(result["phh2o"] / 10.0, 2)
        if "clay" in result:
            mapped["clay"] = round(result["clay"] / 10.0, 2)
        if "sand" in result:
            mapped["sand"] = round(result["sand"] / 10.0, 2)
        if "silt" in result:
            mapped["silt"] = round(result["silt"] / 10.0, 2)
        if "soc" in result:
            soc_pct = result["soc"] / 100.0
            mapped["materia_organica"] = round(soc_pct * 1.724, 2)
            
        return {"success": True, "data": mapped}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: fetch_soilgrids.py <lat> <lon>"}))
        sys.exit(1)
    try:
        lat = float(sys.argv[1])
        lon = float(sys.argv[2])
        res = fetch_precision_soil(lat, lon)
        print(json.dumps(res, indent=2))
    except Exception as ex:
        print(json.dumps({"success": False, "error": str(ex)}))
