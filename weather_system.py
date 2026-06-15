import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # 无 GUI 后端，用于服务器环境
import matplotlib.pyplot as plt
import os
import io
import base64
import json
import tempfile
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from flask import Flask, request, jsonify
from flask_cors import CORS

# ========== 添加中文字体支持 ==========
import platform
system = platform.system()
if system == 'Windows':
    plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei']  # 使用黑体和微软雅黑
elif system == 'Darwin':  # macOS
    plt.rcParams['font.sans-serif'] = ['Arial Unicode MS']
else:  # Linux
    plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False  # 解决负号显示问题
# ===================================

from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

# 数据预处理类
class WeatherDataPreprocessor:
    """气象数据预处理工具类"""
    def __init__(self):
        pass

    def load_data(self, file_path, file_type="csv"):
        """加载CSV/Excel格式数据"""
        try:
            if file_type == "csv":
                df = pd.read_csv(file_path)
            elif file_type == "excel":
                df = pd.read_excel(file_path, engine="openpyxl")
            else:
                raise ValueError("仅支持csv和excel格式文件")
            return df
        except Exception as e:
            raise ValueError(f"数据加载失败: {e}")

    def clean_data(self, df):
        """数据清洗：标准化列名、处理时间戳"""
        df_clean = df.copy()
        # 标准化列名（小写、去除空格）
        df_clean.columns = [col.strip().lower().replace(" ", "_") for col in df_clean.columns]
        # 处理时间列
        time_cols = [col for col in df_clean.columns if "time" in col or "date" in col or "timestamp" in col]
        if time_cols:
            df_clean["timestamp"] = pd.to_datetime(df_clean[time_cols[0]])
            df_clean.set_index("timestamp", inplace=True)
        else:
            # 无时间列则创建小时级时间序列
            try:
                df_clean["timestamp"] = pd.date_range(start="2020-01-01", periods=len(df_clean), freq="h")
            except (ValueError, KeyError):
                df_clean["timestamp"] = pd.date_range(start="2020-01-01", periods=len(df_clean), freq="H")
            df_clean.set_index("timestamp", inplace=True)
        return df_clean

    def handle_missing_values(self, df, method="interpolate"):
        """处理缺失值"""
        df_filled = df.copy()
        if method == "interpolate":
            try:
                df_filled = df_filled.interpolate(method="time")
            except (ValueError, KeyError):
                df_filled = df_filled.interpolate(method="linear")
        elif method == "mean":
            df_filled = df_filled.fillna(df_filled.mean())
        elif method == "drop":
            df_filled = df_filled.dropna()
        elif method == "ffill":
            df_filled = df_filled.fillna(method="ffill")
        else:
            raise ValueError("支持的缺失值处理方法：interpolate、mean、drop、ffill")
        return df_filled

    def add_time_features(self, df):
        """新增：提取小时、星期时间特征"""
        df = df.copy()
        if isinstance(df.index, pd.DatetimeIndex):
            df["hour"] = df.index.hour
            df["weekday"] = df.index.weekday
        return df

    def detect_outliers_iqr(self, df):
        """IQR方法检测并处理异常值"""
        df_no_outliers = df.copy()
        numeric_cols = df_no_outliers.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            Q1 = df_no_outliers[col].quantile(0.25)
            Q3 = df_no_outliers[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            # 替换异常值为边界值
            df_no_outliers[col] = np.where(
                df_no_outliers[col] < lower_bound, lower_bound,
                np.where(df_no_outliers[col] > upper_bound, upper_bound, df_no_outliers[col])
            )
        return df_no_outliers

    def prepare_sequences(self, data, seq_length, forecast_horizon=1, target_col_idx=0):
        """准备时间序列数据（支持多变量输入、多步预测）"""
        X, y = [], []
        for i in range(len(data) - seq_length - forecast_horizon + 1):
            X.append(data[i:i + seq_length])
            y.append(data[i + seq_length:i + seq_length + forecast_horizon, target_col_idx])
        return np.array(X), np.array(y).reshape(-1, forecast_horizon)

    def data_normalize(self, df, norm_type="zscore"):
        """数据归一化 zscore / minmax"""
        df_norm = df.copy()
        numeric_cols = df_norm.select_dtypes(include=[np.number]).columns
        if norm_type == "zscore":
            scaler = StandardScaler()
        elif norm_type == "minmax":
            scaler = MinMaxScaler()
        else:
            raise ValueError("仅支持 zscore、minmax")
        df_norm[numeric_cols] = scaler.fit_transform(df_norm[numeric_cols])
        return df_norm, scaler

# 可视化类
class WeatherVisualizer:
    """气象数据可视化工具类"""
    def __init__(self):
        pass

    def plot_time_series(self, data, fields, title="气象数据时间序列趋势图"):
        """绘制时间序列趋势图"""
        fig, ax = plt.subplots(figsize=(12, 6))
        for field in fields:
            if field in data.columns:
                ax.plot(data.index, data[field], label=field, linewidth=2)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel("时间", fontsize=12)
        ax.set_ylabel("数值", fontsize=12)
        ax.legend(fontsize=10)
        ax.grid(alpha=0.3)
        ax.tick_params(axis='both', which='major', labelsize=10)
        fig.tight_layout()
        return fig

    def plot_heatmap(self, data, title="特征相关性热力图"):
        """绘制特征相关性热力图"""
        corr = data.corr()
        fig, ax = plt.subplots(figsize=(10, 8))
        im = ax.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
        
        # 设置坐标轴标签
        ax.set_xticks(np.arange(len(corr.columns)))
        ax.set_yticks(np.arange(len(corr.columns)))
        ax.set_xticklabels(corr.columns, rotation=45, ha="right", fontsize=10)
        ax.set_yticklabels(corr.columns, fontsize=10)
        
        # 添加数值标注
        for i in range(len(corr.columns)):
            for j in range(len(corr.columns)):
                value = corr.iloc[i, j]
                color = "white" if abs(value) > 0.5 else "black"
                ax.text(j, i, f"{value:.2f}", ha="center", va="center", 
                       color=color, fontsize=9, fontweight='bold')
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        plt.colorbar(im, ax=ax)
        fig.tight_layout()
        return fig

    def plot_prediction_results(self, y_true, y_pred, title="LSTM预测结果对比"):
        """绘制预测结果对比图"""
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(y_true, label='真实值', linewidth=2, alpha=0.8)
        ax.plot(y_pred, label='预测值', linewidth=2, alpha=0.8, linestyle='--')
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel("样本索引", fontsize=12)
        ax.set_ylabel("数值", fontsize=12)
        ax.legend(fontsize=10)
        ax.grid(alpha=0.3)
        fig.tight_layout()
        return fig

    def plot_anomaly_detection(self, data, anomaly_labels, title="异常检测结果"):
        """绘制异常检测结果"""
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # 绘制正常点
        normal_mask = anomaly_labels == 0
        if len(data) == len(anomaly_labels):
            time_index = data.index if hasattr(data, 'index') else np.arange(len(data))
            ax.scatter(time_index[normal_mask], data[normal_mask] if hasattr(data, 'values') else data[normal_mask], 
                      label='正常点', alpha=0.6, s=20)
            
            # 绘制异常点
            anomaly_mask = anomaly_labels == 1
            ax.scatter(time_index[anomaly_mask], data[anomaly_mask] if hasattr(data, 'values') else data[anomaly_mask], 
                      label='异常点', color='red', alpha=0.8, s=30, marker='x')
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel("时间/索引", fontsize=12)
        ax.set_ylabel("数值", fontsize=12)
        ax.legend(fontsize=10)
        ax.grid(alpha=0.3)
        fig.tight_layout()
        return fig

# 异常检测类
class AnomalyDetector:
    """异常检测器"""
    def __init__(self, method: str = 'isolation_forest'):
        self.method = method
        self.model = None
        self.scaler = StandardScaler()

    def fit(self, X):
        """训练异常检测模型"""
        X_scaled = self.scaler.fit_transform(X)
        if self.method == "isolation_forest":
            self.model = IsolationForest(contamination=0.05, random_state=42)
            self.model.fit(X_scaled)
        elif self.method == "one_class_svm":
            self.model = OneClassSVM(nu=0.05, kernel="rbf")
            self.model.fit(X_scaled)
        else:
            raise ValueError("仅支持isolation_forest和one_class_svm两种方法")

    def predict(self, X):
        """预测异常值（1=异常，0=正常）"""
        if self.model is None:
            raise RuntimeError("请先调用fit方法训练模型")
        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)
        # 转换为1=异常，0=正常（IsolationForest中-1表示异常，1表示正常）
        return np.where(predictions == -1, 1, 0)

# LSTM预测类
class LSTMTimeSeriesPredictor(nn.Module):
    """LSTM时间序列预测模型"""
    def __init__(self, input_size, hidden_size, num_layers, output_size):
        super(LSTMTimeSeriesPredictor, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, output_size)
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.dropout(out[:, -1, :])
        out = self.fc(out)
        return out

    def train_model(self, X_train, y_train, X_val=None, y_val=None, epochs=30, batch_size=32, lr=0.001, patience=10):
        """训练模型"""
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.to(device)
        criterion = nn.MSELoss()
        optimizer = optim.Adam(self.parameters(), lr=lr)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5, factor=0.5)

        # 转换为Tensor
        X_train_tensor = torch.tensor(X_train, dtype=torch.float32).to(device)
        y_train_tensor = torch.tensor(y_train, dtype=torch.float32).to(device)
        dataset = TensorDataset(X_train_tensor, y_train_tensor)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

        train_losses = []
        val_losses = []
        best_val_loss = float('inf')
        epochs_no_improve = 0

        self.train()
        for epoch in range(epochs):
            running_loss = 0.0
            for batch_X, batch_y in dataloader:
                optimizer.zero_grad()
                outputs = self(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)
                optimizer.step()
                running_loss += loss.item() * batch_X.size(0)
            
            epoch_loss = running_loss / len(dataset)
            train_losses.append(epoch_loss)

            # 验证损失
            val_loss = None
            if X_val is not None and y_val is not None:
                X_val_tensor = torch.tensor(X_val, dtype=torch.float32).to(device)
                y_val_tensor = torch.tensor(y_val, dtype=torch.float32).to(device)
                with torch.no_grad():
                    val_pred = self(X_val_tensor)
                    val_loss = criterion(val_pred, y_val_tensor).item()
                    val_losses.append(val_loss)
                
                scheduler.step(val_loss)
                
                # 早停检查
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    epochs_no_improve = 0
                else:
                    epochs_no_improve += 1
                    
                if epochs_no_improve >= patience:
                    print(f"早停于第 {epoch+1} 轮")
                    break
            
            if (epoch + 1) % 10 == 0:
                if val_loss is not None:
                    print(f"Epoch [{epoch+1}/{epochs}], 训练损失: {epoch_loss:.4f}, 验证损失: {val_loss:.4f}")
                else:
                    print(f"Epoch [{epoch+1}/{epochs}], 训练损失: {epoch_loss:.4f}")

        return train_losses, val_losses

    def predict(self, X_test):
        """预测"""
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.eval()
        X_test_tensor = torch.tensor(X_test, dtype=torch.float32).to(device)
        with torch.no_grad():
            predictions = self(X_test_tensor)
        return predictions.cpu().numpy()

    def evaluate(self, y_true, y_pred):
        """评估预测结果"""
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)
        return {"mse": mse, "rmse": rmse, "mae": mae, "r2": r2}

# GRU 时间序列预测模型
class GRUTimeSeriesPredictor(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size):
        super(GRUTimeSeriesPredictor, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.gru = nn.GRU(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, output_size)
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.gru(x, h0)
        out = self.dropout(out[:, -1, :])
        out = self.fc(out)
        return out

    # 复用训练、预测、评估逻辑，直接继承调用原有方法
    train_model = LSTMTimeSeriesPredictor.train_model
    predict = LSTMTimeSeriesPredictor.predict
    evaluate = LSTMTimeSeriesPredictor.evaluate

# Transformer 时间序列预测模型
class TransformerTimeSeriesPredictor(nn.Module):
    def __init__(self, input_size, d_model, nhead, num_layers, output_size, seq_length):
        super().__init__()
        self.d_model = d_model
        self.seq_length = seq_length
        self.input_proj = nn.Linear(input_size, d_model)
        self.pos_encoding = nn.Parameter(torch.randn(1, seq_length, d_model))
        self.encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=0.2, batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(self.encoder_layer, num_layers=num_layers)
        self.fc = nn.Linear(d_model, output_size)
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        x = self.input_proj(x)
        x = x + self.pos_encoding
        x = self.dropout(x)
        x = self.transformer_encoder(x)
        x = x[:, -1, :]
        out = self.fc(x)
        return out

    train_model = LSTMTimeSeriesPredictor.train_model
    predict = LSTMTimeSeriesPredictor.predict
    evaluate = LSTMTimeSeriesPredictor.evaluate

# ========== Flask API 服务器 ==========

app = Flask(__name__)
CORS(app)

preprocessor = WeatherDataPreprocessor()
visualizer = WeatherVisualizer()

# 内存中存储上传的数据（单用户场景）
_data_store = {"df": None, "df_processed": None, "anomaly_labels": None}


def _df_to_json(df):
    """将 DataFrame 转为前端可消费的 JSON 格式"""
    if df is None:
        return None
    result = df.reset_index().copy()
    for col in result.select_dtypes(include=['datetime64', 'datetimetz']).columns:
        result[col] = result[col].astype(str)
    return json.loads(result.to_json(orient="records", force_ascii=False))


def _describe_to_json(df):
    """将 describe 统计信息转为 JSON"""
    if df is None:
        return None
    desc = df.describe().round(2)
    result = {}
    for col in desc.columns:
        result[col] = {
            "count": int(desc[col].get("count", 0)),
            "mean": float(desc[col].get("mean", 0)),
            "std": float(desc[col].get("std", 0)),
            "min": float(desc[col].get("min", 0)),
            "q1": float(desc[col].get("25%", 0)),
            "median": float(desc[col].get("50%", 0)),
            "q3": float(desc[col].get("75%", 0)),
            "max": float(desc[col].get("max", 0)),
        }
    return result


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "气象数据分析系统 API 运行中"})


@app.route("/api/upload", methods=["POST"])
def upload():
    """上传 CSV/Excel 文件并返回数据预览"""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "未找到上传文件"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "文件名为空"}), 400

    try:
        # 保存到临时文件
        suffix = ".csv" if file.filename.endswith(".csv") else ".xlsx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        file_type = "csv" if suffix == ".csv" else "excel"
        df = preprocessor.load_data(tmp_path, file_type)
        os.unlink(tmp_path)  # 删除临时文件

        _data_store["df"] = df
        _data_store["df_processed"] = None
        _data_store["anomaly_labels"] = None

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        return jsonify({
            "success": True,
            "data": {
                "shape": list(df.shape),
                "columns": list(df.columns),
                "numeric_columns": numeric_cols,
                "dtypes": {k: str(v) for k, v in df.dtypes.items()},
                "missing": df.isnull().sum().to_dict(),
                "describe": _describe_to_json(df),
                "preview": _df_to_json(df.head(100)),
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/preprocess", methods=["POST"])
def preprocess():
    """数据预处理：缺失值 + IQR 异常值清洗"""
    body = request.get_json() or {}

    # 支持两种输入：直接传 JSON 数据 或 使用之前上传的文件
    if "data" in body:
        df = pd.DataFrame(body["data"])
        # 不要在这里 set_index，让 clean_data 统一处理时间列
        _data_store["df"] = df
    elif _data_store["df"] is not None:
        df = _data_store["df"]
    else:
        return jsonify({"success": False, "error": "请先上传数据"}), 400

    missing_method = body.get("missing_method", "interpolate")
    use_iqr = body.get("use_iqr", True)

    try:
        df_clean = preprocessor.clean_data(df)
        df_clean = preprocessor.add_time_features(df_clean)
        df_filled = preprocessor.handle_missing_values(df_clean, method=missing_method)

        if use_iqr:
            df_processed = preprocessor.detect_outliers_iqr(df_filled)
        else:
            df_processed = df_filled

        _data_store["df_processed"] = df_processed

        return jsonify({
            "success": True,
            "data": {
                "shape": list(df_processed.shape),
                "columns": list(df_processed.columns),
                "missing_after": df_processed.isnull().sum().to_dict(),
                "describe": _describe_to_json(df_processed),
                "processed_data": _df_to_json(df_processed),
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/anomaly", methods=["POST"])
def anomaly():
    """异常检测：Isolation Forest / One-Class SVM"""
    body = request.get_json() or {}

    if "data" in body:
        df = pd.DataFrame(body["data"])
    elif _data_store["df_processed"] is not None:
        df = _data_store["df_processed"]
    elif _data_store["df"] is not None:
        df = _data_store["df"]
    else:
        return jsonify({"success": False, "error": "请先上传或预处理数据"}), 400

    method = body.get("method", "isolation_forest")
    contamination = body.get("contamination", 0.05)

    try:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_cols) == 0:
            return jsonify({"success": False, "error": "没有数值列可用于异常检测"}), 400

        detector = AnomalyDetector(method=method)
        # 覆盖默认 contamination
        if method == "isolation_forest":
            detector.model = None  # reset
            detector.scaler = StandardScaler()
            X_scaled = detector.scaler.fit_transform(df[numeric_cols])
            detector.model = IsolationForest(contamination=contamination, random_state=42)
            detector.model.fit(X_scaled)
        else:
            detector.fit(df[numeric_cols])

        labels = detector.predict(df[numeric_cols])
        anomaly_count = int(np.sum(labels))
        anomaly_indices = np.where(labels == 1)[0].tolist()

        _data_store["anomaly_labels"] = labels

        return jsonify({
            "success": True,
            "data": {
                "method": method,
                "contamination": contamination,
                "total_points": len(labels),
                "anomaly_count": anomaly_count,
                "anomaly_percentage": round((anomaly_count / len(labels)) * 100, 2),
                "anomaly_indices": anomaly_indices[:50],
                "labels": labels.tolist(),
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/predict", methods=["POST"])
def predict():
    """LSTM 时间序列预测"""
    body = request.get_json() or {}

    if "data" in body:
        df = pd.DataFrame(body["data"])
    elif _data_store["df_processed"] is not None:
        df = _data_store["df_processed"]
    elif _data_store["df"] is not None:
        df = _data_store["df"]
    else:
        return jsonify({"success": False, "error": "请先上传或预处理数据"}), 400

    target_field = body.get("target_field", "temperature")
    seq_length = int(body.get("seq_length", 24))
    epochs = int(body.get("epochs", 30))
    forecast_steps = int(body.get("forecast_steps", 1))
    model_type = body.get("model_type", "lstm")

    # 多气象指标联合输入（不少于3个）
    feature_fields = body.get("feature_fields", ["temperature", "humidity", "wind_speed"])
    for f in feature_fields:
        if f not in df.columns:
            return jsonify({"success": False, "error": f"特征字段 '{f}' 不存在"}), 400
    if target_field not in feature_fields:
        feature_fields = [target_field] + [c for c in df.select_dtypes(include=[np.number]).columns.tolist() if c != target_field][:2]

    try:
        data_multi = df[feature_fields].values.astype(np.float32)
        # 数据归一化（关键：加速训练收敛）
        scaler = MinMaxScaler()
        data_multi = scaler.fit_transform(data_multi)
        target_col_idx = feature_fields.index(target_field)

        X, y = preprocessor.prepare_sequences(
            data=data_multi,
            seq_length=seq_length,
            forecast_horizon=forecast_steps,
            target_col_idx=target_col_idx
        )

        if len(X) < 10:
            return jsonify({"success": False, "error": "数据量不足以训练模型，至少需要更多数据"}), 400

        X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, shuffle=False)
        X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, shuffle=False)

        input_dim = len(feature_fields)
        if model_type == "lstm":
            predictor = LSTMTimeSeriesPredictor(
                input_size=input_dim, hidden_size=64, num_layers=2, output_size=forecast_steps
            )
        elif model_type == "gru":
            predictor = GRUTimeSeriesPredictor(
                input_size=input_dim, hidden_size=64, num_layers=2, output_size=forecast_steps
            )
        else:
            return jsonify({"success": False, "error": "仅支持 lstm / gru 模型"}), 400

        train_losses, val_losses = predictor.train_model(
            X_train, y_train, X_val, y_val,
            epochs=epochs, batch_size=32, lr=0.001
        )

        predictions = predictor.predict(X_test)

        # 反归一化到原始尺度
        t_idx = feature_fields.index(target_field)
        dummy_test = np.zeros((len(y_test), len(feature_fields)))
        dummy_test[:, t_idx] = y_test[:, 0] if forecast_steps == 1 else y_test[:, 0]
        y_test_raw = scaler.inverse_transform(dummy_test)[:, t_idx].reshape(-1, 1)
        dummy_pred = np.zeros((len(predictions), len(feature_fields)))
        dummy_pred[:, t_idx] = predictions[:, 0] if forecast_steps == 1 else predictions[:, 0]
        predictions_raw = scaler.inverse_transform(dummy_pred)[:, t_idx].reshape(-1, 1)

        metrics = predictor.evaluate(y_test_raw, predictions_raw)

        # 测试集对比
        comparison = []
        for i in range(min(100, len(y_test_raw))):
            comparison.append({
                "index": i,
                "actual": round(float(y_test_raw[i][0]), 2),
                "predicted": round(float(predictions_raw[i][0]), 2),
                "error": round(abs(float(y_test_raw[i][0]) - float(predictions_raw[i][0])), 2),
            })

        return jsonify({
            "success": True,
            "data": {
                "target_field": target_field,
                "seq_length": seq_length,
                "epochs": epochs,
                "train_losses": [round(float(x), 6) for x in train_losses],
                "val_losses": [round(float(x), 6) for x in val_losses],
                "metrics": {
                    "mse": round(float(metrics["mse"]), 4),
                    "rmse": round(float(metrics["rmse"]), 4),
                    "mae": round(float(metrics["mae"]), 4),
                    "r2": round(float(metrics["r2"]), 4),
                },
                "comparison": comparison,
                "test_shape": list(X_test.shape),
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/compare_model", methods=["POST"])
def compare_model():
    """新增：LSTM & GRU 双模型对比评估"""
    body = request.get_json() or {}
    if _data_store["df_processed"] is not None:
        df = _data_store["df_processed"]
    elif _data_store["df"] is not None:
        df = _data_store["df"]
    else:
        return jsonify({"success": False, "error": "请先上传并预处理数据"}), 400

    target_field = body.get("target_field", "temperature")
    feature_fields = body.get("feature_fields", ["temperature", "humidity", "wind_speed"])
    seq_length = body.get("seq_length", 24)
    forecast_steps = body.get("forecast_steps", 24)
    epochs = body.get("epochs", 20)

    # 数据准备
    data_multi = df[feature_fields].values.astype(np.float32)
    target_col_idx = feature_fields.index(target_field)
    X, y = preprocessor.prepare_sequences(data_multi, seq_length, forecast_steps, target_col_idx)
    if len(X) < 10:
        return jsonify({"success": False, "error": "数据量不足"}), 400

    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, shuffle=False)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, shuffle=False)
    input_dim = len(feature_fields)

    # 训练 LSTM
    lstm_model = LSTMTimeSeriesPredictor(input_dim, 64, 2, forecast_steps)
    lstm_model.train_model(X_train, y_train, X_val, y_val, epochs=epochs)
    lstm_pred = lstm_model.predict(X_test)
    lstm_metric = lstm_model.evaluate(y_test, lstm_pred)

    # 训练 GRU
    gru_model = GRUTimeSeriesPredictor(input_dim, 64, 2, forecast_steps)
    gru_model.train_model(X_train, y_train, X_val, y_val, epochs=epochs)
    gru_pred = gru_model.predict(X_test)
    gru_metric = gru_model.evaluate(y_test, gru_pred)

    return jsonify({
        "success": True,
        "data": {
            "lstm_metrics": lstm_metric,
            "gru_metrics": gru_metric,
            "compare_desc": "数值越小表示误差越低，R²越接近1效果越好"
        }
    })

if __name__ == "__main__":
    print("=" * 50)
    print("  气象数据分析与预测系统 - API 服务器")
    print("  运行地址: http://localhost:5000")
    print("  健康检查: http://localhost:5000/api/health")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False)
