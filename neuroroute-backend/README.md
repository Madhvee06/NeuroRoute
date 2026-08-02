# NeuroRoute Backend

Backend API for **NeuroRoute — An Agentic AI-Based Personalized Navigation System for Sensory-Friendly Travel**.

Built with **Node.js, Express, and MongoDB (Mongoose)**. Implements the rule-based Sensory Scoring
formula from the project synopsis, using OpenStreetMap (Nominatim geocoding + OSRM routing +
Overpass API) for real map data.

## 1. Prerequisites

- Node.js 18+ and npm — check with `node -v`
- MongoDB running somewhere, either:
  - **Local**: install MongoDB Community Server and run it (`mongod`), or
  - **Atlas (free, no local install)**: create a free cluster at https://www.mongodb.com/cloud/atlas and copy its connection string

## 2. Setup (in VS Code)

1. Open this folder (`neuroroute-backend`) in VS Code.
2. Open a terminal (`` Ctrl+` ``) and install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template and fill in your values:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   - `MONGODB_URI` — your local (`mongodb://127.0.0.1:27017/neuroroute`) or Atlas connection string
   - `JWT_SECRET` — any long random string (e.g. generate one with `openssl rand -hex 32`)
   - The OSRM / Overpass / Nominatim URLs can be left as their public defaults for development.

4. Start the server:
   ```bash
   npm run dev
   ```
   You should see:
   ```
   🗄️  Connected to MongoDB
   🚀 NeuroRoute backend running on http://localhost:5000
   ```
5. Visit `http://localhost:5000` in a browser — you should see `{"message":"NeuroRoute API is running"}`.

No manual schema setup is needed — Mongoose creates collections automatically the first time
data is written.

## 3. Project structure

```
neuroroute-backend/
├── server.js                  # Entry point — wires everything together
├── package.json
├── .env.example                # Copy to .env and fill in secrets
├── src/
│   ├── config/db.js            # MongoDB connection (Mongoose)
│   ├── middleware/
│   │   ├── auth.js             # Blocks request without a valid JWT
│   │   └── optionalAuth.js     # Attaches user if token present, else guest
│   ├── models/
│   │   ├── User.js             # name, email, passwordHash, profile, preferences
│   │   ├── Journey.js          # each planned route (history)
│   │   ├── Feedback.js         # post-journey comfort rating
│   │   └── CommunityReport.js  # user-flagged crowd/noise/construction spots
│   ├── services/
│   │   ├── geocodeService.js   # text address -> lat/lng (Nominatim)
│   │   ├── osrmService.js      # lat/lng pair -> candidate routes (OSRM)
│   │   ├── overpassService.js  # nearby parks/libraries/cafes (Overpass API)
│   │   └── sensoryScore.js     # the S = W1*Traffic + ... scoring engine
│   ├── controllers/            # request handlers for each resource
│   └── routes/                 # Express routers mapping URLs -> controllers
```

## 4. API Reference

All request/response bodies are JSON. Protected routes require:
`Authorization: Bearer <token>` (token returned from signup/login).

### Auth
| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/signup` | – | `{ name, email, password, profile? }` |
| POST | `/api/auth/login` | – | `{ email, password }` |
| GET | `/api/auth/me` | required | – |

`profile` is one of `"Autistic User"`, `"Elderly User"`, `"General User"` (defaults to General User).

### Route planning (the core feature)
| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | `/api/routes/plan` | optional | `{ source, destination, profile, preferences }` |
| POST | `/api/routes/reevaluate` | optional | `{ journeyId?, currentLat, currentLng, destination, profile, preferences }` |
| GET | `/api/routes/history` | required | – |

`source` / `destination` can be a text address (`"Bandra Reclamation Park, Mumbai"`) or `"lat,lng"`.
`preferences` example: `{ "avoidCrowds": true, "avoidNoise": true, "avoidBrightLights": false }`.

Response from `/api/routes/plan`:
```json
{
  "journeyId": "…",
  "recommendedRoute": { "id": 0, "distanceMeters": 2400, "durationSeconds": 780, "sensoryScore": 42.1, "geometry": {...}, "segments": [...] },
  "alternativeRoutes": [ ... ],
  "nearbyQuietPlaces": [ { "id": "...", "name": "Carter Road Library", "type": "Library · Quiet", "lat": ..., "lng": ... } ],
  "explanation": "This route was chosen for a Autistic User profile because..."
}
```

### Places
| Method | Endpoint | Auth | Query |
|---|---|---|---|
| GET | `/api/places/nearby` | – | `?lat=..&lng=..&radius=1500` |

### Preferences
| Method | Endpoint | Auth | Body |
|---|---|---|---|
| GET | `/api/preferences` | required | – |
| PUT | `/api/preferences` | required | any subset of `{ avoidCrowds, avoidNoise, avoidBrightLights, avoidConstruction, preferParks, preferSafeRoutes }` |

### Feedback
| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | `/api/feedback` | required | `{ journeyId, rating: "Comfortable"\|"Moderate"\|"Stressful", comments? }` |

### Community Reports
| Method | Endpoint | Auth | Body / Query |
|---|---|---|---|
| POST | `/api/reports` | required | `{ lat, lng, reportType: "crowd"\|"noise"\|"construction"\|"hazard"\|"event", description? }` |
| GET | `/api/reports/nearby` | – | `?lat=..&lng=..&radiusKm=2` |

## 5. Quick test with curl

```bash
# Sign up
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Surabhi","email":"surabhi@test.com","password":"test123","profile":"Autistic User"}'

# Plan a route (paste the token from signup)
curl -X POST http://localhost:5000/api/routes/plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"source":"Bandra Station, Mumbai","destination":"Carter Road, Mumbai","profile":"Autistic User","preferences":{"avoidCrowds":true,"avoidNoise":true}}'
```

## 6. Connecting your Expo app

In `HomeScreen.js`, `LoginScreen.js`, and `SignupScreen.js`, replace the `// TODO: replace with
real call to your Express backend` comments with `fetch()` or `axios` calls to
`http://<your-computer-IP>:5000/api/...` (use your machine's local IP, not `localhost`, since
the Expo app runs on a phone/emulator).

## 7. Important notes on the sensory scoring engine

The formula from the synopsis (`S = W1·Traffic + W2·Crowd + W3·Noise + W4·Brightness +
W5·Construction + W6·Weather`) is fully implemented in `src/services/sensoryScore.js`. To keep this
backend runnable without any paid API keys, the underlying **environmental readings per road
segment are currently deterministic placeholders** (see the comment block at the top of that file).
Swap in the listed real data sources (TomTom Traffic, OpenWeatherMap, community reports, etc.)
when you're ready to move past the prototype stage — the scoring, weighting, and route-comparison
logic downstream will keep working unchanged.

The Machine Learning (Random Forest) and full Agentic AI (LangGraph/CrewAI) layers described in
the synopsis are future-scope items and are **not** implemented here; `/api/routes/reevaluate` is a
lightweight stand-in that demonstrates the re-routing behavior using the same rule-based engine.
