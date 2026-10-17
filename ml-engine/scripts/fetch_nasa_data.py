#!/usr/bin/env python
import sys
import json
import urllib.request
import numpy as np

def fetch_precision_weather(lat, lon):
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m&hourly=soil_temperature_0cm&timezone=auto"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (AgroPredict/2.0)'})
        with urllib.request.urlopen(req, timeout=5.0) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        current = data.get("current", {})
        hourly = data.get("hourly", {})
        
        mapped = {
            "temperatura": float(current.get("temperature_2m", 25.0)),
            "humedad": float(current.get("relative_humidity_2m", 70.0)),
            "viento": float(current.get("wind_speed_10m", 10.0)),
            "lluvia_reciente": float(current.get("rain", 0.0))
        }
        
        soil_temps = hourly.get("soil_temperature_0cm", [])
        if soil_temps:
            mapped["temperatura_suelo"] = round(float(np.mean(soil_temps[:24])), 2)
        else:
            mapped["temperatura_suelo"] = mapped["temperatura"]
            
        return {"success": True, "data": mapped}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: fetch_nasa_data.py <lat> <lon>"}))
        sys.exit(1)
    try:
        lat = float(sys.argv[1])
        lon = float(sys.argv[2])
        res = fetch_precision_weather(lat, lon)
        print(json.dumps(res, indent=2))
    except Exception as ex:
        print(json.dumps({"success": False, "error": str(ex)}))
