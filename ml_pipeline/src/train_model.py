import pandas as pd
import xgboost as xgb
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import root_mean_squared_error, mean_absolute_error, r2_score

def train_risk_model():
    # Dynamically find the absolute path to your ml_pipeline folder
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    data_path = os.path.join(base_dir, 'datasets', 'synthetic_cdms.csv')
    if not os.path.exists(data_path):
        data_path = os.path.join(base_dir, 'datasets', 'real_cdms.csv')
        
    model_dir = os.path.join(base_dir, 'models')
    model_path = os.path.join(model_dir, 'risk_xgboost_v1.pkl')

    if not os.path.exists(data_path):
        print(f"Dataset not found at {data_path}. Run generate_data.py first.")
        return

    print("Loading data...")
    df = pd.read_csv(data_path)
    
    X = df[['miss_distance_km', 'relative_velocity_km_s', 'bstar_1', 'bstar_2']]
    y = df['target_risk_score']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=100, 
        learning_rate=0.1, 
        max_depth=5, 
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    rmse = root_mean_squared_error(y_test, predictions)
    print(f"Model Evaluation - MAE: {mae:.4f} | RMSE: {rmse:.4f}")
    
    # Ensure the models folder exists, then save the file
    os.makedirs(model_dir, exist_ok=True)
    joblib.dump(model, model_path)
    print(f"Model successfully saved to {model_path}")

if __name__ == "__main__":
    train_risk_model()