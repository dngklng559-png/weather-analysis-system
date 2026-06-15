/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MeteorologicalRecord {
  timestamp: string;
  temperature: number;      // °C
  humidity: number;         // %
  pressure: number;         // hPa
  windSpeed: number;        // m/s
  precipitation: number;    // mm
  radiation: number;        // W/m²
  isAnomaly: boolean;       // Status flag for anomaly
  anomalyScore: number;     // 0 to 1 confidence/magnitude
  anomalyType: string;      // Category of anomaly
  weatherType: string;      // Weather condition for classification
}

export interface PredictionRecord {
  timestamp: string;
  actual?: number;
  predicted: number;
}

export interface ModelMetrics {
  rmse: number;
  mae: number;
  r2: number;
  bias: number;
}

export type PredictionHorizon = '6h' | '24h' | '7d';
export type PredictionModel = 'LSTM' | 'Transformer';
export type AnomalyAlgorithm = 'IF' | 'AE'; // Isolation Forest / Autoencoder

export type AnomalyWeatherType = 
  | '高温' 
  | '低温' 
  | '大风' 
  | '暴雨' 
  | '暴雪' 
  | '寒潮' 
  | '雷暴' 
  | '雾霾' 
  | '无异常';

export interface AnomalyWeatherClassification {
  timestamp: string;
  type: AnomalyWeatherType;
  severity: '轻度' | '中度' | '重度';
  indicators: {
    temperature?: number;
    windSpeed?: number;
    precipitation?: number;
    humidity?: number;
    pressure?: number;
  };
  confidence: number; // 0-1 confidence score
}

export interface AnomalyWeatherStats {
  type: AnomalyWeatherType;
  count: number;
  percentage: number;
  avgSeverity: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  recentOccurrences: string[];
}

export interface AnomalyWeatherAnalysis {
  totalAnomalies: number;
  classifiedRecords: AnomalyWeatherClassification[];
  statistics: AnomalyWeatherStats[];
  timeDistribution: { hour: number; count: number }[];
  weeklyTrend: { day: string; count: number }[];
}
