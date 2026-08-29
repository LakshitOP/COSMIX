import pandas as pd
import joblib
import os
from sklearn.metrics import root_mean_squared_error, r2_score, mean_absolute_error
from sklearn.model_selection import train_test_split

def evaluate_model():
    # Dynamically find absolute paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, 'models', 'risk_xgboost_v1.pkl')
    data_path = os.path.join(base_dir, 'datasets', 'synthetic_cdms.csv')
    if not os.path.exists(data_path):
        data_path = os.path.join(base_dir, 'datasets', 'real_cdms.csv')

    if not os.path.exists(model_path) or not os.path.exists(data_path):
        print(f"Error: Could not find files.")
        print(f"Looking for model at: {model_path}")
        print(f"Looking for data at: {data_path}")
        print("Please run generate_data.py then train_model.py first.")
        return

    print(f"Loading XGBoost model from {model_path}...")
    model = joblib.load(model_path)
    
    print(f"Loading testing data from {data_path}...")
    df = pd.read_csv(data_path)

    X = df[['miss_distance_km', 'relative_velocity_km_s', 'bstar_1', 'bstar_2']]
    y = df['target_risk_score']
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Running predictions against the held-out synthetic test split...")
    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = root_mean_squared_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    print("\n" + "="*30)
    print("  SYNTHETIC-DATA REGRESSION CHECK")
    print("="*30)
    print(f"Mean Absolute Error (MAE): {mae:.4f}")
    print(f"Root Mean Squared (RMSE):  {rmse:.4f}")
    print(f"R-Squared (R2) Score:      {r2:.4f}")
    print("\nThese metrics verify pipeline consistency only; they are not collision-risk validation.")

    print("\n" + "="*30)
    print("  FEATURE IMPORTANCES")
    print("="*30)
    importances = model.feature_importances_
    for feature, imp in zip(X.columns, importances):
        print(f"{feature.ljust(25)}: {imp * 100:.2f}%")

if __name__ == "__main__":
    evaluate_model()
