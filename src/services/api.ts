/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 气象数据分析系统 API 服务层
 * 封装所有后端 Python Flask API 调用
 */

const API_BASE = '/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==========================================
// 数据类型
// ==========================================

export interface UploadResult {
  shape: [number, number];
  columns: string[];
  numeric_columns: string[];
  dtypes: Record<string, string>;
  missing: Record<string, number>;
  describe: Record<string, {
    count: number;
    mean: number;
    std: number;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  }>;
  preview: Record<string, any>[];
}

export interface PreprocessResult {
  shape: [number, number];
  columns: string[];
  missing_after: Record<string, number>;
  describe: Record<string, any>;
  processed_data: Record<string, any>[];
}

export interface AnomalyResult {
  method: string;
  contamination: number;
  total_points: number;
  anomaly_count: number;
  anomaly_percentage: number;
  anomaly_indices: number[];
  labels: number[];
}

export interface PredictResult {
  target_field: string;
  seq_length: number;
  epochs: number;
  train_losses: number[];
  val_losses: number[];
  metrics: {
    mse: number;
    rmse: number;
    mae: number;
    r2: number;
  };
  comparison: Array<{
    index: number;
    actual: number;
    predicted: number;
    error: number;
  }>;
  test_shape: [number, number, number];
}

// ==========================================
// 通用请求函数
// ==========================================

async function apiPost<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  const options: RequestInit = {
    method: 'POST',
    headers: body instanceof FormData
      ? {} // FormData 自动设置 Content-Type
      : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, options);
  const result: ApiResponse<T> = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || `API 请求失败 (${response.status})`);
  }

  return result;
}

// ==========================================
// API 函数
// ==========================================

/** 健康检查 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

/** 上传 CSV/Excel 文件 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiPost<UploadResult>('/upload', formData);
  return res.data!;
}

/** 数据预处理 */
export async function runPreprocessing(params: {
  data?: Record<string, any>[];
  missing_method?: 'interpolate' | 'mean' | 'drop';
  use_iqr?: boolean;
}): Promise<PreprocessResult> {
  const res = await apiPost<PreprocessResult>('/preprocess', params);
  return res.data!;
}

/** 异常检测 */
export async function detectAnomalies(params: {
  data?: Record<string, any>[];
  method?: 'isolation_forest' | 'one_class_svm';
  contamination?: number;
}): Promise<AnomalyResult> {
  const res = await apiPost<AnomalyResult>('/anomaly', params);
  return res.data!;
}

/** LSTM 预测 */
export async function runPrediction(params: {
  data?: Record<string, any>[];
  target_field?: string;
  seq_length?: number;
  epochs?: number;
}): Promise<PredictResult> {
  const res = await apiPost<PredictResult>('/predict', params);
  return res.data!;
}
