"""
NeuroRoute — Random Forest Training (fast, no-frills version)

Trains on training_data.csv (from generate_data.py) and saves the
model. No hyperparameter tuning, minimal evaluation — this is
intentional given the 10-day deadline. Swap in real feedback data
later and rerun this exact same script.

Run: python train_model.py
Output: comfort_model.pkl
"""

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import LabelEncoder
import joblib

data = pd.read_csv("training_data.csv")

# One-hot encode profile (autistic/elderly/general) so the model can use it
data = pd.get_dummies(data, columns=["profile"], prefix="profile")

feature_cols = [
    "traffic", "crowd", "noise", "brightness", "construction", "weather",
    "profile_autistic", "profile_elderly", "profile_general",
]
# Some profile dummy columns might not exist if a category never appeared —
# guard against that so training doesn't crash
for col in feature_cols:
    if col not in data.columns:
        data[col] = 0

X = data[feature_cols]
y = data["comfort_label"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

acc = accuracy_score(y_test, model.predict(X_test))
print(f"Test accuracy: {acc:.2%}  (not the priority right now, just a sanity check)")

joblib.dump({"model": model, "feature_cols": feature_cols}, "comfort_model.pkl")
print("Saved comfort_model.pkl")