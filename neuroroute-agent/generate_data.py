"""
NeuroRoute — Synthetic Training Data Generator (real traffic + weather version)

Traffic and weather now come from real APIs (TomTom, OpenWeatherMap) for
random real-world points within a city bounding box. Crowd, noise,
brightness, and construction remain simulated — no free API exists for
these. Comfort labels are still computed by your own formula, same as
before — no real "ground truth" comfort data exists anywhere to use
instead.

Setup:
  pip install requests python-dotenv
  Create a .env file with:
    TOMTOM_API_KEY=your_key_here
    OPENWEATHER_API_KEY=your_key_here

Run: python generate_data_real_apis.py
Output: training_data.csv
"""

import random
import csv
import time
import os
import requests
from dotenv import load_dotenv

load_dotenv()

TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

PROFILES = ["autistic", "elderly", "general"]

PROFILE_WEIGHTS = {
    "autistic": {"traffic": 1.0, "crowd": 1.5, "noise": 1.6, "brightness": 1.4, "construction": 1.3, "weather": 0.8},
    "elderly":  {"traffic": 1.4, "crowd": 1.0, "noise": 0.9, "brightness": 0.8, "construction": 1.5, "weather": 1.2},
    "general":  {"traffic": 1.0, "crowd": 1.0, "noise": 1.0, "brightness": 1.0, "construction": 1.0, "weather": 1.0},
}

# Rough bounding box for Mumbai — swap for your own city/region
LAT_RANGE = (18.90, 19.30)
LNG_RANGE = (72.75, 72.95)

# Cache API results by rounded coordinate, so nearby random points reuse
# the same call instead of hitting the API again — this is what keeps
# you inside free-tier rate limits
_traffic_cache = {}
_weather_cache = {}


def random_point():
    lat = round(random.uniform(*LAT_RANGE), 3)
    lng = round(random.uniform(*LNG_RANGE), 3)
    return lat, lng


def fetch_traffic(lat, lng):
    """Returns a 0-1 congestion score: 0 = free flowing, 1 = fully jammed."""

    key = (lat, lng)

    if key in _traffic_cache:
        return _traffic_cache[key]

    try:
        if not TOMTOM_API_KEY:
            raise RuntimeError("TOMTOM_API_KEY is missing from .env")

        url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"

        params = {
            "key": TOMTOM_API_KEY,
            "point": f"{lat},{lng}"
        }

        res = requests.get(
            url,
            params=params,
            timeout=(5, 10)
        )

        res.raise_for_status()

        data = res.json()

        current_speed = data["flowSegmentData"]["currentSpeed"]
        free_flow_speed = data["flowSegmentData"]["freeFlowSpeed"]

        congestion = (
            1 - (current_speed / free_flow_speed)
            if free_flow_speed > 0
            else 0.5
        )

        congestion = max(0, min(1, congestion))

        print(
            f"  Traffic OK: "
            f"current={current_speed}, "
            f"free-flow={free_flow_speed}, "
            f"congestion={congestion:.3f}"
        )

    except requests.exceptions.Timeout:
        print(f"  Traffic API timeout for {lat},{lng} — using random fallback")
        congestion = random.uniform(0, 1)

    except requests.exceptions.SSLError as e:
        print(f"  Traffic SSL error for {lat},{lng}: {e}")
        print("  Using random fallback")
        congestion = random.uniform(0, 1)

    except requests.exceptions.RequestException as e:
        print(f"  Traffic API request failed for {lat},{lng}: {e}")
        print("  Using random fallback")
        congestion = random.uniform(0, 1)

    except Exception as e:
        print(f"  Traffic API failed for {lat},{lng}: {e}")
        print("  Using random fallback")
        congestion = random.uniform(0, 1)

    _traffic_cache[key] = congestion

    time.sleep(0.2)

    return congestion


def fetch_weather(lat, lng):
    """Returns a 0-1 'weather severity' score: 0 = clear, 1 = severe."""
    key = (lat, lng)

    if key in _weather_cache:
        return _weather_cache[key]

    try:
        if not OPENWEATHER_API_KEY:
            raise RuntimeError("OPENWEATHER_API_KEY is missing from .env")

        url = "https://api.openweathermap.org/data/2.5/weather"

        params = {
            "lat": lat,
            "lon": lng,
            "appid": OPENWEATHER_API_KEY
        }

        res = requests.get(
            url,
            params=params,
            timeout=(5, 10)
        )

        # Raise an error for HTTP errors such as 401, 403, 429, 500
        res.raise_for_status()

        data = res.json()

        condition = data["weather"][0]["main"].lower()

        severity_map = {
            "clear": 0.05,
            "clouds": 0.2,
            "mist": 0.4,
            "fog": 0.6,
            "drizzle": 0.5,
            "rain": 0.7,
            "thunderstorm": 0.9,
            "snow": 0.8,
        }

        severity = severity_map.get(condition, 0.3)

        print(f"  Weather OK: {condition} -> {severity}")

    except requests.exceptions.Timeout:
        print(f"  Weather API timeout for {lat},{lng} — using random fallback")
        severity = random.uniform(0, 1)

    except requests.exceptions.SSLError as e:
        print(f"  Weather SSL error for {lat},{lng}: {e}")
        print("  Using random fallback")
        severity = random.uniform(0, 1)

    except requests.exceptions.RequestException as e:
        print(f"  Weather API request failed for {lat},{lng}: {e}")
        print("  Using random fallback")
        severity = random.uniform(0, 1)

    except Exception as e:
        print(f"  Weather API failed for {lat},{lng}: {e}")
        print("  Using random fallback")
        severity = random.uniform(0, 1)

    _weather_cache[key] = severity

    time.sleep(0.2)

    return severity


def score_to_label(score):
    if score <= 35:
        return "Comfortable"
    elif score <= 65:
        return "Moderate"
    else:
        return "Stressful"


def generate_row():
    profile = random.choice(PROFILES)
    weights = PROFILE_WEIGHTS[profile]
    lat, lng = random_point()

    traffic = fetch_traffic(lat, lng)       # REAL data now
    weather = fetch_weather(lat, lng)       # REAL data now
    crowd = random.uniform(0, 1)            # still simulated
    noise = random.uniform(0, 1)            # still simulated
    brightness = random.uniform(0, 1)       # still simulated
    construction = random.uniform(0, 1)     # still simulated

    raw_score = (
        weights["traffic"] * traffic
        + weights["crowd"] * crowd
        + weights["noise"] * noise
        + weights["brightness"] * brightness
        + weights["construction"] * construction
        + weights["weather"] * weather
    )
    max_weight = sum(weights.values())

    score = min(
    100,
    round((raw_score / max_weight) * 100, 2)
)
    label = score_to_label(score)

    return {
        "lat": lat, "lng": lng,
        "traffic": round(traffic, 3), "crowd": round(crowd, 3), "noise": round(noise, 3),
        "brightness": round(brightness, 3), "construction": round(construction, 3),
        "weather": round(weather, 3), "profile": profile,
        "score": score, "comfort_label": label,
    }


def main(n_rows=300, out_path="training_data.csv"):
    # n_rows deliberately much lower than the pure-random version (6000) —
    # this is the direct cost of real API rate limits. Raise it only if
    # your API tier can handle 2x n_rows calls comfortably.
    rows = []
    for i in range(n_rows):
        rows.append(generate_row())
        if (i + 1) % 25 == 0:
            print(f"  generated {i + 1}/{n_rows}")

    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {n_rows} rows to {out_path}")


if __name__ == "__main__":
    main()