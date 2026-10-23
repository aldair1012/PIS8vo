"""Proveedores externos de datos para el motor de ZeaSys.

Este módulo mantiene separada la obtención de datos de la construcción de
features. Cada respuesta incluye procedencia y fecha de consulta para que el
dashboard y el chatbot no presenten estimaciones como si fueran mediciones.

Los proveedores se consultan en este orden para clima operativo:

1. Open-Meteo (condiciones actuales y pronóstico).
2. NASA POWER (último dato diario disponible como respaldo).

Ningún proveedor puede bloquear una predicción: si una API está caída, se
devuelve ``None`` y el llamador conserva los valores introducidos por el
usuario o el baseline histórico.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import json
import math
import os
from typing import Any, Dict, Iterable, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen


USER_AGENT = os.getenv("ZEASYS_DATA_USER_AGENT", "ZeaSys/2.2 (+agro-data-provider)")
DEFAULT_TIMEOUT_SECONDS = float(os.getenv("ZEASYS_DATA_TIMEOUT_SECONDS", "6"))


class ProviderError(RuntimeError):
    """Error controlado al consultar un proveedor externo."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _as_number(value: Any) -> Optional[float]:
    """Convierte un valor a float, descartando NaN, infinitos y sentinelas."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= -999:
        return None
    return number


def _first_number(values: Iterable[Any]) -> Optional[float]:
    for value in values:
        number = _as_number(value)
        if number is not None:
            return number
    return None


def _mean_numbers(values: Iterable[Any]) -> Optional[float]:
    numbers = [_as_number(value) for value in values]
    valid = [number for number in numbers if number is not None]
    return sum(valid) / len(valid) if valid else None


def _request_json(url: str, timeout: Optional[float] = None) -> Dict[str, Any]:
    """Realiza una petición JSON acotada y con un User-Agent identificable."""
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=timeout or DEFAULT_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", 200)
            if status >= 400:
                raise ProviderError(f"HTTP {status}")
            payload = json.loads(response.read().decode("utf-8"))
    except ProviderError:
        raise
    except Exception as exc:  # pragma: no cover - el detalle depende de la red
        raise ProviderError(str(exc)) from exc

    if not isinstance(payload, dict):
        raise ProviderError("La respuesta no contiene un objeto JSON")
    if payload.get("error") is True:
        reason = payload.get("reason") or payload.get("message") or "respuesta marcada como error"
        raise ProviderError(str(reason))
    return payload


def _open_meteo_url(latitude: float, longitude: float) -> str:
    # Las variables agrícolas se mantienen en una sola petición para evitar
    # llamadas duplicadas desde el dashboard y el motor ML.
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,rain,wind_speed_10m",
        "hourly": ",".join(
            (
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "rain",
                "wind_speed_10m",
                "et0_fao_evapotranspiration",
                "vapour_pressure_deficit",
                "soil_temperature_0cm",
                "soil_moisture_0_to_1cm",
                "soil_moisture_1_to_3cm",
                "soil_moisture_3_to_9cm",
                "soil_moisture_9_to_27cm",
                "soil_moisture_27_to_81cm",
                "shortwave_radiation",
            )
        ),
        "daily": ",".join(
            (
                "temperature_2m_mean",
                "temperature_2m_min",
                "temperature_2m_max",
                "precipitation_sum",
                "et0_fao_evapotranspiration",
                "shortwave_radiation_sum",
            )
        ),
        "forecast_days": 7,
        "timezone": "auto",
    }
    return "https://api.open-meteo.com/v1/forecast?" + urlencode(params)


def _open_meteo_historical_url(latitude: float, longitude: float, start: date, end: date) -> str:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily": ",".join(
            (
                "temperature_2m_mean",
                "temperature_2m_min",
                "temperature_2m_max",
                "precipitation_sum",
                "et0_fao_evapotranspiration",
                "shortwave_radiation_sum",
            )
        ),
        "timezone": "auto",
    }
    return "https://archive-api.open-meteo.com/v1/archive?" + urlencode(params)


def fetch_open_meteo(latitude: float, longitude: float, timeout: Optional[float] = None) -> Dict[str, Any]:
    """Obtiene clima actual, pronóstico y variables agrícolas de Open-Meteo."""
    payload = _request_json(_open_meteo_url(latitude, longitude), timeout)
    current = payload.get("current") or {}
    hourly = payload.get("hourly") or {}
    daily = payload.get("daily") or {}

    temperature = _as_number(current.get("temperature_2m"))
    humidity = _as_number(current.get("relative_humidity_2m"))
    if temperature is None or humidity is None:
        raise ProviderError("Open-Meteo no devolvió temperatura o humedad actuales")

    def first_hours(name: str, count: int = 24) -> list[Any]:
        values = hourly.get(name) or []
        return values[:count]

    daily_precip = daily.get("precipitation_sum") or []
    daily_et0 = daily.get("et0_fao_evapotranspiration") or []
    vpd = _mean_numbers(first_hours("vapour_pressure_deficit"))
    soil_moisture = {}
    for layer in ("0_to_1cm", "1_to_3cm", "3_to_9cm", "9_to_27cm", "27_to_81cm"):
        value = _mean_numbers(first_hours(f"soil_moisture_{layer}"))
        if value is not None:
            # Open-Meteo devuelve humedad volumétrica m³/m³; el dashboard
            # trabaja con porcentaje para que la unidad sea explícita.
            soil_moisture[f"humedad_suelo_{layer}_pct"] = round(value * 100, 2)

    mapped: Dict[str, Any] = {
        "temperatura_media_c": temperature,
        "humedad_relativa_pct": humidity,
        "viento_speed": _as_number(current.get("wind_speed_10m")),
        "lluvia_reciente": _as_number(current.get("rain")),
        "precipitacion_pronostico_7d_mm": round(sum(v for v in (_as_number(x) for x in daily_precip) if v is not None), 2),
        "et0_pronostico_7d_mm": round(sum(v for v in (_as_number(x) for x in daily_et0) if v is not None), 2),
        "vpd_24h_kpa": round(vpd, 4) if vpd is not None else None,
        "temperatura_suelo_c": _mean_numbers(first_hours("soil_temperature_0cm")),
        "radiacion_media_24h_w_m2": _mean_numbers(first_hours("shortwave_radiation")),
        "temperatura_min_pronostico_c": _first_number(daily.get("temperature_2m_min") or []),
        "temperatura_max_pronostico_c": _first_number(daily.get("temperature_2m_max") or []),
        "source": "open_meteo",
        "source_kind": "forecast",
        "retrieved_at": _utc_now(),
        "timezone": payload.get("timezone"),
        "forecast_days": len(daily_precip),
        "quality": "model",
    }
    mapped.update(soil_moisture)
    # Los campos None se eliminan: ausente no significa cero.
    return {key: value for key, value in mapped.items() if value is not None}


def fetch_open_meteo_historical(
    latitude: float,
    longitude: float,
    start: Optional[date] = None,
    end: Optional[date] = None,
    timeout: Optional[float] = None,
) -> Dict[str, Any]:
    """Obtiene un resumen histórico diario de Open-Meteo ERA5/ERA5-Land.

    Se usa bajo demanda (`incluir_historico=true`) porque una predicción normal
    no debe esperar una segunda consulta de red. La serie se conserva para que
    el dashboard pueda calcular anomalías con la misma unidad y periodo.
    """
    end = end or (date.today() - timedelta(days=1))
    start = start or (end - timedelta(days=30))
    if start > end:
        raise ProviderError("El inicio histórico no puede ser posterior al fin")

    payload = _request_json(_open_meteo_historical_url(latitude, longitude, start, end), timeout)
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    if not dates:
        raise ProviderError("Open-Meteo no devolvió una serie histórica")

    precipitation = daily.get("precipitation_sum") or []
    et0 = daily.get("et0_fao_evapotranspiration") or []
    temperature = daily.get("temperature_2m_mean") or []
    radiation = daily.get("shortwave_radiation_sum") or []

    def total(values: Iterable[Any]) -> Optional[float]:
        numbers = [_as_number(value) for value in values]
        valid = [number for number in numbers if number is not None]
        return round(sum(valid), 2) if valid else None

    summary = {
        "temperatura_media_c": round(_mean_numbers(temperature), 2) if _mean_numbers(temperature) is not None else None,
        "precipitacion_total_mm": total(precipitation),
        "et0_total_mm": total(et0),
        "radiacion_media_mj_m2_d": round(_mean_numbers(radiation), 2) if _mean_numbers(radiation) is not None else None,
    }
    series = []
    for index, day in enumerate(dates):
        series.append(
            {
                "fecha": day,
                "temperatura_media_c": _as_number(temperature[index]) if index < len(temperature) else None,
                "precipitacion_mm": _as_number(precipitation[index]) if index < len(precipitation) else None,
                "et0_mm": _as_number(et0[index]) if index < len(et0) else None,
                "radiacion_mj_m2_d": _as_number(radiation[index]) if index < len(radiation) else None,
            }
        )

    return {
        "source": "open_meteo",
        "source_kind": "historical_reanalysis",
        "quality": "reanalysis",
        "start_date": dates[0],
        "end_date": dates[-1],
        "retrieved_at": _utc_now(),
        "timezone": payload.get("timezone"),
        "summary": {key: value for key, value in summary.items() if value is not None},
        "daily": series,
    }


def _nasa_power_url(latitude: float, longitude: float, start: date, end: date) -> str:
    params = {
        "parameters": "T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN",
        "community": "AG",
        "longitude": longitude,
        "latitude": latitude,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }
    return "https://power.larc.nasa.gov/api/temporal/daily/point?" + urlencode(params)


def fetch_nasa_power(latitude: float, longitude: float, timeout: Optional[float] = None) -> Dict[str, Any]:
    """Obtiene el último día disponible de NASA POWER como respaldo."""
    end = date.today()
    start = end - timedelta(days=7)
    payload = _request_json(_nasa_power_url(latitude, longitude, start, end), timeout)
    parameters = ((payload.get("properties") or {}).get("parameter") or {})
    dates = set()
    for values in parameters.values():
        if isinstance(values, dict):
            dates.update(values.keys())
    if not dates:
        raise ProviderError("NASA POWER no devolvió fechas")

    ordered_dates = sorted(dates, reverse=True)
    latest = ordered_dates[0]

    def latest_value(name: str) -> Optional[float]:
        values = parameters.get(name) or {}
        return _as_number(values.get(latest)) if isinstance(values, dict) else None

    temperature = latest_value("T2M")
    humidity = latest_value("RH2M")
    if temperature is None or humidity is None:
        raise ProviderError("NASA POWER no devolvió T2M o RH2M")

    mapped = {
        "temperatura_media_c": temperature,
        "temperatura_min_c": latest_value("T2M_MIN"),
        "temperatura_max_c": latest_value("T2M_MAX"),
        "humedad_relativa_pct": humidity,
        "precipitacion_diaria_mm": latest_value("PRECTOTCORR"),
        "radiacion_solar_mj_m2_d": latest_value("ALLSKY_SFC_SW_DWN"),
        "source": "nasa_power",
        "source_kind": "historical_daily",
        "observed_date": latest,
        "retrieved_at": _utc_now(),
        "quality": "reanalysis",
    }
    return {key: value for key, value in mapped.items() if value is not None}


def fetch_weather_with_fallback(latitude: float, longitude: float, timeout: Optional[float] = None) -> Dict[str, Any]:
    """Consulta Open-Meteo y cae a NASA POWER si el primer proveedor falla."""
    errors: Dict[str, str] = {}
    try:
        result = fetch_open_meteo(latitude, longitude, timeout)
        result["fallback_used"] = False
        return result
    except ProviderError as exc:
        errors["open_meteo"] = str(exc)

    try:
        result = fetch_nasa_power(latitude, longitude, timeout)
        result["fallback_used"] = True
        result["provider_errors"] = errors
        return result
    except ProviderError as exc:
        errors["nasa_power"] = str(exc)
        return {
            "source": "unavailable",
            "source_kind": "none",
            "retrieved_at": _utc_now(),
            "quality": "unavailable",
            "provider_errors": errors,
        }
