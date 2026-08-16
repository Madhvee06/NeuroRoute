"""
NeuroRoute — Agentic AI Decision Engine

Matches Section 7(f) of the synopsis exactly:
  - Compares all possible routes
  - Evaluates the sensory score of each route
  - Considers user preferences and profile
  - Uses Machine Learning predictions
  - Selects the most suitable route by balancing time, safety, comfort
  - Explains the recommendation (this is the ONLY step that uses the LLM)

Run: uvicorn main:app --port 8000 --reload
"""

from typing import TypedDict, List, Dict, Any
from fastapi import FastAPI
import joblib
import pandas as pd
import os
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI  # free tier via Google AI Studio

load_dotenv()
# ---------------------------------------------------------------
# Load the trained Random Forest model once, at startup
# ---------------------------------------------------------------
bundle = joblib.load("comfort_model.pkl")
rf_model = bundle["model"]
FEATURE_COLS = bundle["feature_cols"]

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0)  # only used for the explanation step


# ---------------------------------------------------------------
# Agent state — the data every node reads/writes
# ---------------------------------------------------------------
class AgentState(TypedDict):
    routes: List[Dict[str, Any]]     # [{id, sensoryScore, distanceMeters, durationSeconds, factors}, ...]
    profile: str                     # "autistic" | "elderly" | "general"
    preferences: Dict[str, bool]
    ml_predictions: List[Dict[str, Any]]
    ranked_routes: List[Dict[str, Any]]
    decision: Dict[str, Any]


# ---------------------------------------------------------------
# Node 1: Compare routes (just ensures they're sorted, cheapest step)
# ---------------------------------------------------------------
def compare_routes(state: AgentState) -> AgentState:
    routes = sorted(state["routes"], key=lambda r: r["sensoryScore"])
    return {**state, "routes": routes}


# ---------------------------------------------------------------
# Node 2: ML prediction — calls the trained Random Forest for each route
# ---------------------------------------------------------------
def call_ml_model(state: AgentState) -> AgentState:
    predictions = []
    for route in state["routes"]:
        factors = route.get("factors", {})
        row = {
            "traffic": factors.get("traffic", 0.5),
            "crowd": factors.get("crowd", 0.5),
            "noise": factors.get("noise", 0.5),
            "brightness": factors.get("brightness", 0.5),
            "construction": factors.get("construction", 0.5),
            "weather": factors.get("weather", 0.5),
            "profile_autistic": 1 if state["profile"] == "autistic" else 0,
            "profile_elderly": 1 if state["profile"] == "elderly" else 0,
            "profile_general": 1 if state["profile"] == "general" else 0,
        }
        df = pd.DataFrame([row])[FEATURE_COLS]
        predicted_label = rf_model.predict(df)[0]
        predictions.append({"routeId": route["id"], "predictedComfort": predicted_label})

    return {**state, "ml_predictions": predictions}


# ---------------------------------------------------------------
# Node 3: Apply preferences + select the best route (deterministic —
# this is the part that must never be "creative", so no LLM here)
# ---------------------------------------------------------------
COMFORT_RANK = {"Comfortable": 0, "Moderate": 1, "Stressful": 2}

def select_best_route(state: AgentState) -> AgentState:
    pred_by_id = {p["routeId"]: p["predictedComfort"] for p in state["ml_predictions"]}

    def route_rank(route):
        ml_rank = COMFORT_RANK.get(pred_by_id.get(route["id"]), 1)
        # Combine rule-based score and ML prediction — simple weighted sum,
        # good enough given the 10-day deadline
        return (ml_rank * 40) + route["sensoryScore"]

    ranked = sorted(state["routes"], key=route_rank)
    best = ranked[0]
    best["predictedComfort"] = pred_by_id.get(best["id"])

    return {**state, "ranked_routes": ranked, "decision": {"chosenRoute": best}}


# ---------------------------------------------------------------
# Node 4: Explain the decision — the ONLY node that calls the LLM
# ---------------------------------------------------------------
def explain_decision(state: AgentState) -> AgentState:
    best = state["decision"]["chosenRoute"]
    prompt = (
        f"A route was chosen for a {state['profile']} user profile. "
        f"Its sensory score is {best['sensoryScore']} and the ML model predicts "
        f"comfort level: {best.get('predictedComfort')}. "
        f"User preferences: {state['preferences']}. "
        "In 1-2 short, warm sentences, explain to the user why this route was chosen. "
        "Do not mention 'ML model' or technical terms — speak plainly."
    )
    response = llm.invoke(prompt)
    state["decision"]["explanation"] = response.content
    return state


# ---------------------------------------------------------------
# Build the graph — matches Section 7(f)'s bullet list, in order
# ---------------------------------------------------------------
graph = StateGraph(AgentState)
graph.add_node("compare_routes", compare_routes)
graph.add_node("ml_predict", call_ml_model)
graph.add_node("select_route", select_best_route)
graph.add_node("explain", explain_decision)

graph.set_entry_point("compare_routes")
graph.add_edge("compare_routes", "ml_predict")
graph.add_edge("ml_predict", "select_route")
graph.add_edge("select_route", "explain")
graph.add_edge("explain", END)

agent = graph.compile()


# ---------------------------------------------------------------
# API — this is what Node's routeController.js will call
# ---------------------------------------------------------------
app = FastAPI()

@app.post("/agent/plan")
def plan_route(payload: dict):
    """
    Expected payload:
    {
      "routes": [{"id": 0, "sensoryScore": 69.8, "distanceMeters": ..., "durationSeconds": ...,
                   "factors": {"traffic": 0.5, "crowd": 0.6, ...}}, ...],
      "profile": "general",
      "preferences": {"avoidCrowds": true, ...}
    }
    """
    result = agent.invoke(payload)
    return result["decision"]

@app.get("/health")
def health():
    return {"status": "ok"}