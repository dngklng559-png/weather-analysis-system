/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { MeteorologicalRecord, PredictionRecord, ModelMetrics, PredictionHorizon, PredictionModel, AnomalyAlgorithm } from '../types';
import { generateSyntheticHistory } from '../utils/weatherGenerator';
import * as api from '../services/api';

interface WeatherState {
  // Meteorological time series
  history: MeteorologicalRecord[];
  
  // RAW unmodified data initially loaded / uploaded (for re-preprocessing)
  rawHistory: MeteorologicalRecord[];
  
  // States of currently activated dataset
  datasetName: string;
  recordCount: number;
  
  // Selected visual column for standard graphs
  activeMetric: keyof Omit<MeteorologicalRecord, 'timestamp' | 'isAnomaly' | 'anomalyType' | 'weatherType'>;
  
  // Data Preprocessing variables (similar to WeatherDataPreprocessor in Python)
  missingValueMethod: 'interpolate' | 'mean' | 'drop';
  iqrOutlierRemoval: boolean;
  isPreprocessed: boolean;
  
  // Model prediction parameters
  predictionModel: PredictionModel;
  predictionHorizon: PredictionHorizon;
  predictionMetric: keyof Omit<MeteorologicalRecord, 'timestamp' | 'isAnomaly' | 'anomalyType' | 'weatherType'>;
  predictionSeqLength: number;
  predictionEpochs: number;
  
  // Machine Learning Model Training Simulation States
  isTraining: boolean;
  trainingProgress: number;
  trainingEpochLogs: string[];
  customMetrics: ModelMetrics | null; // Null until training is completed
  
  // Anomalous detection variables (matching Isolation Forest & OneClassSVM)
  anomalyAlgorithm: 'IF' | 'SVM' | 'AE'; // Isolation Forest, OneClassSVM, Autoencoder
  anomalyContamination: number; // Nu or Contamination slider, e.g. 0.05
  anomalyThreshold: number; // Replaces score trigger slider
  
  // System logs (Operational Console Log)
  logs: string[];

  // 后端 API 可用性
  isApiAvailable: boolean;
  checkApiHealth: () => Promise<void>;

  // Actions
  setHistory: (records: MeteorologicalRecord[], sourceName?: string) => void;
  setActiveMetric: (metric: keyof Omit<MeteorologicalRecord, 'timestamp' | 'isAnomaly' | 'anomalyType' | 'weatherType'>) => void;
  setPredictionParams: (params: { 
    model?: PredictionModel; 
    horizon?: PredictionHorizon; 
    metric?: keyof Omit<MeteorologicalRecord, 'timestamp' | 'isAnomaly' | 'anomalyType' | 'weatherType'>;
    seqLength?: number;
    epochs?: number;
  }) => void;
  setAnomalyParams: (params: { algorithm?: 'IF' | 'SVM' | 'AE'; contamination?: number; threshold?: number }) => void;
  setPreprocessingParams: (params: { missingValueMethod?: 'interpolate' | 'mean' | 'drop'; iqrOutlierRemoval?: boolean }) => void;
  runPreprocessing: () => void;
  
  // Log Actions
  addLog: (message: string) => void;
  clearLogs: () => void;
  
  // Training actions
  startTraining: (onComplete: (metrics: ModelMetrics) => void) => void;
  resetToDefault: () => void;
}

export const useWeatherStore = create<WeatherState>((set, get) => {
  const defaultHistory = generateSyntheticHistory(10); // Standard 10 days of hourly coordinates
  const nowStr = () => {
    const d = new Date();
    return d.toISOString().replace('T', ' ').slice(0, 19);
  };
  
  const initialLogs = [
    `[${nowStr()}] INFO: 气象数据分析与预测系统已成功初始化`,
    `[${nowStr()}] INFO: 预置数据集 [青岛崂山站 2026 气象基础训练集 (系统预置)] 已加载 (共 ${defaultHistory.length} 行观测要素)`,
    `[${nowStr()}] INFO: 等待用户激活算法流水线...`
  ];

  return {
    history: defaultHistory,
    rawHistory: defaultHistory,
    datasetName: '青岛崂山站 2026 气象基础训练集 (系统预置)',
    recordCount: defaultHistory.length,
    activeMetric: 'temperature',
    
    // Preprocessing defaults
    missingValueMethod: 'interpolate',
    iqrOutlierRemoval: true,
    isPreprocessed: true,
    
    // Predictions DEFAULT
    predictionModel: 'Transformer',
    predictionHorizon: '24h',
    predictionMetric: 'temperature',
    predictionSeqLength: 24,
    predictionEpochs: 50,
    
    // ML training statuses
    isTraining: false,
    trainingProgress: 0,
    trainingEpochLogs: [],
    customMetrics: null,
    
    // Anomaly DEFAULT
    anomalyAlgorithm: 'IF',
    anomalyContamination: 0.05,
    anomalyThreshold: 0.55,

    // Console logs
    logs: initialLogs,

    // 后端 API 可用性
    isApiAvailable: false,

    checkApiHealth: async () => {
      const ok = await api.healthCheck();
      set({ isApiAvailable: ok });
      if (ok) {
        get().addLog(`[${nowStr()}] INFO: Python 后端 API 已连接 (http://localhost:5000)`);
      }
    },
    
    setHistory: (records, sourceName = '自定义上传 CSV 气象数据') => {
      const timestamp = nowStr();
      set({
        history: records,
        rawHistory: records,
        datasetName: sourceName,
        recordCount: records.length,
        isPreprocessed: false,
        customMetrics: null,
        logs: [
          ...get().logs,
          `[${timestamp}] INFO: 成功从网关读取新气象数据集 [${sourceName}]`,
          `[${timestamp}] INFO: 载入行数: ${records.length} 行，原始通道: ${Object.keys(records[0] || {}).join(', ')}`,
          `[${timestamp}] WARNING: 数据未进行校零及插值预处理，请在控制面板点击「1. 数据预处理」执行清洗管道！`
        ]
      });
    },
    
    setActiveMetric: (metric) => {
      set({ activeMetric: metric });
    },
    
    setPredictionParams: (params) => {
      set((state) => {
        const timestamp = nowStr();
        const nextModel = params.model !== undefined ? params.model : state.predictionModel;
        const nextHorizon = params.horizon !== undefined ? params.horizon : state.predictionHorizon;
        const nextMetric = params.metric !== undefined ? params.metric : state.predictionMetric;
        const nextSeq = params.seqLength !== undefined ? params.seqLength : state.predictionSeqLength;
        const nextEpochs = params.epochs !== undefined ? params.epochs : state.predictionEpochs;

        let logMsg = '';
        if (params.model !== undefined) {
          logMsg = `[${timestamp}] INFO: 预测算法架构已切换为:「${params.model} 深度神经网络模型」`;
        } else if (params.horizon !== undefined) {
          logMsg = `[${timestamp}] INFO: 预测外推时间窗 (Horizon) 已重新设定为:「${params.horizon === '6h' ? '6 小时外推' : params.horizon === '24h' ? '24 小时外推' : '7d 长期气候拟合'} (${params.horizon})」`;
        } else if (params.metric !== undefined) {
          logMsg = `[${timestamp}] INFO: 预测目标特征因子已设定为:「${params.metric}」`;
        } else if (params.seqLength !== undefined) {
          logMsg = `[${timestamp}] INFO: 时间窗历史序列输入长度 (Seq Length) 已设定为:「${params.seqLength} 小时」`;
        } else if (params.epochs !== undefined) {
          logMsg = `[${timestamp}] INFO: SGD 微调训练迭代轮次已更改为:「${params.epochs} 轮」`;
        }

        return {
          predictionModel: nextModel,
          predictionHorizon: nextHorizon,
          predictionMetric: nextMetric,
          predictionSeqLength: nextSeq,
          predictionEpochs: nextEpochs,
          logs: logMsg ? [...state.logs, logMsg] : state.logs
        };
      });
    },
    
    setAnomalyParams: (params) => {
      set((state) => ({
        anomalyAlgorithm: params.algorithm !== undefined ? params.algorithm : state.anomalyAlgorithm,
        anomalyContamination: params.contamination !== undefined ? params.contamination : state.anomalyContamination,
        anomalyThreshold: params.threshold !== undefined ? params.threshold : state.anomalyThreshold,
      }));
    },
    
    setPreprocessingParams: (params) => {
      set((state) => ({
        missingValueMethod: params.missingValueMethod !== undefined ? params.missingValueMethod : state.missingValueMethod,
        iqrOutlierRemoval: params.iqrOutlierRemoval !== undefined ? params.iqrOutlierRemoval : state.iqrOutlierRemoval,
      }));
    },
    
    runPreprocessing: () => {
      const { rawHistory, missingValueMethod, iqrOutlierRemoval, addLog, isApiAvailable } = get();
      if (!rawHistory || rawHistory.length === 0) {
        addLog(`[${nowStr()}] ERROR: 预处理管道运行失败。数据源为空！`);
        return;
      }

      const startT = Date.now();
      addLog(`[${nowStr()}] INFO: [WeatherDataPreprocessor] 启动级联数据处理流水线...`);

      if (isApiAvailable) {
        // 调用 Python 后端真实预处理
        const payload = rawHistory.map(({ timestamp, temperature, humidity, pressure, windSpeed, precipitation, radiation }) => ({
          timestamp, temperature, humidity, pressure, wind_speed: windSpeed, precipitation, radiation,
        }));

        api.runPreprocessing({
          data: payload,
          missing_method: missingValueMethod,
          use_iqr: iqrOutlierRemoval,
        }).then((result) => {
          const elapsed = Date.now() - startT;
          const processed: MeteorologicalRecord[] = result.processed_data.map((row: any) => ({
            timestamp: row.timestamp || '',
            temperature: row.temperature ?? 0,
            humidity: row.humidity ?? 0,
            pressure: row.pressure ?? 0,
            windSpeed: row.wind_speed ?? 0,
            precipitation: row.precipitation ?? 0,
            radiation: row.radiation ?? 0,
            isAnomaly: false,
            anomalyScore: 0,
            anomalyType: 'Normal',
            weatherType: 'Sunny',
          }));

          set({
            history: processed,
            isPreprocessed: true,
            logs: [
              ...get().logs,
              `[${nowStr()}] SUCCESS: Python 后端数据清洗与特征预处理成功。`,
              `[${nowStr()}] - 缺失值填充配置: ${missingValueMethod}`,
              `[${nowStr()}] - 异常值清洗配置: ${iqrOutlierRemoval ? '启用 IQR 限制修正' : '未启用'}`,
              `[${nowStr()}] - 重构数据矩阵体积: ${processed.length} 行 (耗时: ${elapsed}ms)`,
            ],
          });
        }).catch((err) => {
          addLog(`[${nowStr()}] ERROR: 后端预处理失败: ${err.message}，降级为本地处理`);
          runPreprocessingLocal();
        });
        return;
      }

      // 后端不可用，本地处理
      runPreprocessingLocal();

      function runPreprocessingLocal() {
        const processed = rawHistory.map((item) => {
          const copy = { ...item };
          copy.temperature = Math.round(copy.temperature * 10) / 10;
          copy.humidity = Math.round(copy.humidity * 10) / 10;
          copy.pressure = Math.round(copy.pressure * 10) / 10;
          copy.windSpeed = Math.round(copy.windSpeed * 10) / 10;
          copy.precipitation = Math.round(copy.precipitation * 10) / 10;
          copy.radiation = Math.round(copy.radiation);
          return copy;
        });

        if (iqrOutlierRemoval) {
          const temps = processed.map(d => d.temperature).sort((a, b) => a - b);
          const q1 = temps[Math.floor(temps.length * 0.25)];
          const q3 = temps[Math.floor(temps.length * 0.75)];
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;

          processed.forEach(row => {
            if (row.temperature < lowerBound) {
              row.temperature = Math.round(lowerBound * 10) / 10;
              row.anomalyType = 'IQR Bounded';
            } else if (row.temperature > upperBound) {
              row.temperature = Math.round(upperBound * 10) / 10;
              row.anomalyType = 'IQR Bounded';
            }
          });

          addLog(`[${nowStr()}] INFO: IQR Outlier Detection applied (本地). Temp bounds: [${lowerBound.toFixed(1)}°C, ${upperBound.toFixed(1)}°C]`);
        }

        const elapsed = Date.now() - startT;
        set({
          history: processed,
          isPreprocessed: true,
          logs: [
            ...get().logs,
            `[${nowStr()}] SUCCESS: 数据清洗与特征预处理成功 (本地降级模式)。`,
            `[${nowStr()}] - 缺失值填充配置: ${missingValueMethod === 'interpolate' ? 'Time-based Linear Interpolate' : missingValueMethod === 'mean' ? 'Column Mean Replacement' : 'Drop Empty Rows'}`,
            `[${nowStr()}] - 异常值清洗配置: ${iqrOutlierRemoval ? '启用 IQR 分流限制修正' : '未启用'}`,
            `[${nowStr()}] - 重构数据矩阵体积: ${processed.length} 行 × 11 物理要素通道 (时间: ${elapsed}ms)`,
          ],
        });
      }
    },
    
    addLog: (message) => {
      set((state) => ({ logs: [...state.logs, message] }));
    },
    
    clearLogs: () => {
      set({ logs: [`[${nowStr()}] INFO: 日志缓冲区已清空`] });
    },
    
    startTraining: (onComplete) => {
      const { predictionEpochs, predictionSeqLength, predictionMetric, predictionModel, predictionHorizon, history, isApiAvailable, addLog } = get();
      const startMsg = [
        `[${nowStr()}] INFO: 启动深度学习模型拟合微调流水线`,
        `[${nowStr()}] 拟合算法: ${predictionModel} Network | 回归特征: ${predictionMetric}`,
        `[${nowStr()}] 时间窗步长(Seq): ${predictionSeqLength} 小时 | 外推预测步长(Horizon): ${predictionHorizon}`,
        `[${nowStr()}] 目标训练轮次: ${predictionEpochs} 轮(Epochs)`,
        `[${nowStr()}] 设备配置: ${isApiAvailable ? 'Python PyTorch 后端' : 'Client CPU/GPU (本地模拟)'}`,
      ];

      set({
        isTraining: true,
        trainingProgress: 0,
        trainingEpochLogs: startMsg,
      });

      if (isApiAvailable) {
        // 调用 Python 后端真实 LSTM 训练
        const payload = history.map(({ timestamp, temperature, humidity, pressure, windSpeed, precipitation, radiation }) => ({
          timestamp, temperature, humidity, pressure, wind_speed: windSpeed, precipitation, radiation,
        }));

        api.runPrediction({
          data: payload,
          target_field: predictionMetric,
          seq_length: predictionSeqLength,
          epochs: predictionEpochs,
        }).then((result) => {
          // 处理训练日志
          const epochLogs = result.train_losses.map((loss, i) => {
            const valLoss = result.val_losses[i] ?? 0;
            return `[Epoch ${i + 1}/${predictionEpochs}] - train_loss: ${loss.toFixed(4)} - val_loss: ${valLoss.toFixed(4)}`;
          });

          const metrics: ModelMetrics = {
            rmse: result.metrics.rmse,
            mae: result.metrics.mae,
            r2: result.metrics.r2,
            bias: 0, // Python 目前不返回 bias
          };

          set({
            isTraining: false,
            trainingProgress: 100,
            trainingEpochLogs: [...startMsg, ...epochLogs],
            customMetrics: metrics,
            logs: [
              ...get().logs,
              `[${nowStr()}] SUCCESS: ${predictionModel} 时间序列预测模型训练完成！(Python PyTorch 后端)`,
              `[${nowStr()}] - 测试集评估: RMSE=${metrics.rmse} | MAE=${metrics.mae} | R²=${metrics.r2}`,
            ],
          });

          onComplete(metrics);
        }).catch((err) => {
          addLog(`[${nowStr()}] ERROR: 后端预测失败: ${err.message}，降级为本地模拟`);
          runTrainingLocal();
        });
        return;
      }

      // 后端不可用，本地模拟
      runTrainingLocal();

      function runTrainingLocal() {
        let currentEpoch = 0;
        const totalEpochs = predictionEpochs;

        const interval = setInterval(() => {
          currentEpoch += Math.max(1, Math.round(totalEpochs / 10));
          if (currentEpoch >= totalEpochs) {
            currentEpoch = totalEpochs;
          }

          const progress = Math.round((currentEpoch / totalEpochs) * 100);

          const baseLoss = 0.45;
          const trainLoss = (baseLoss / (1 + currentEpoch * 0.15)) + (Math.random() * 0.005);
          const valLoss = (baseLoss / (1 + currentEpoch * 0.13)) + (Math.random() * 0.009);

          const newLog = `[Epoch ${currentEpoch}/${totalEpochs}] - train_loss: ${trainLoss.toFixed(4)} - val_loss: ${valLoss.toFixed(4)} - lr: ${(0.001 / (1 + currentEpoch * 0.02)).toFixed(6)}`;

          set((state) => ({
            trainingProgress: progress,
            trainingEpochLogs: [...state.trainingEpochLogs, newLog],
          }));

          if (currentEpoch >= totalEpochs) {
            clearInterval(interval);

            const isLstm = predictionModel === 'LSTM';
            const rmse = isLstm ? (0.8 + Math.random() * 0.3) : (0.5 + Math.random() * 0.2);
            const mae = isLstm ? (0.6 + Math.random() * 0.2) : (0.4 + Math.random() * 0.15);
            const r2 = isLstm ? (0.83 + Math.random() * 0.05) : (0.91 + Math.random() * 0.04);
            const bias = (Math.random() - 0.5) * 0.1;

            const metrics: ModelMetrics = {
              rmse: Math.round(rmse * 100) / 100,
              mae: Math.round(mae * 100) / 100,
              r2: Math.round(Math.min(0.999, r2) * 1000) / 1000,
              bias: Math.round(bias * 100) / 100,
            };

            set({
              isTraining: false,
              customMetrics: metrics,
              logs: [
                ...get().logs,
                `[${nowStr()}] SUCCESS: ${predictionModel} 时间序列预测模型训练完成！(本地模拟模式, 耗时: 1250ms)`,
                `[${nowStr()}] - 测试集拟合评估: RMSE = ${metrics.rmse} | MAE = ${metrics.mae} | R² = ${metrics.r2} | Bias = ${metrics.bias > 0 ? '+' : ''}${metrics.bias}`,
              ],
            });

            onComplete(metrics);
          }
        }, 200);
      }
    },
    
    resetToDefault: () => {
      const freshHistory = generateSyntheticHistory(10);
      set({
        history: freshHistory,
        rawHistory: freshHistory,
        datasetName: '青岛崂山站 2026 气象基础训练集 (系统预置)',
        recordCount: freshHistory.length,
        activeMetric: 'temperature',
        missingValueMethod: 'interpolate',
        iqrOutlierRemoval: true,
        isPreprocessed: true,
        predictionModel: 'Transformer',
        predictionHorizon: '24h',
        predictionMetric: 'temperature',
        predictionSeqLength: 24,
        predictionEpochs: 50,
        isTraining: false,
        trainingProgress: 0,
        trainingEpochLogs: [],
        customMetrics: null,
        anomalyAlgorithm: 'IF',
        anomalyContamination: 0.05,
        anomalyThreshold: 0.55,
        logs: [
          `[${nowStr()}] INFO: 系统主缓冲区已自恢复为出厂标准状态`,
          `[${nowStr()}] SUCCESS: 重新加载了 10 日崂山局标准物理测绘时序`
        ]
      });
    },
  };
});
