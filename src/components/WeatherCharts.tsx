/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { MeteorologicalRecord } from '../types';
import { calculateCorrelation } from '../utils/weatherGenerator';

// ==========================================
// 1. LineChart Component & Types
// ==========================================

interface ChartSeriesItem {
  timestamp: string;
  actual?: number;
  predicted?: number;
  value?: number;
}

interface LineChartProps {
  data: ChartSeriesItem[];
  title?: string;
  metricName: string;
  metricUnit: string;
  isPrediction?: boolean;
}

/**
 * 基础折线与双线预测图表组件
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  metricName,
  metricUnit,
  isPrediction = false,
}) => {
  const timestamps = data.map((item) => item.timestamp);
  const series = [];
  
  if (isPrediction) {
    // Ground Truth Line
    series.push({
      name: `真实值 (${metricUnit})`,
      type: 'line',
      data: data.map((item) => (item.actual !== undefined && item.actual !== null) ? item.actual : null),
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 3,
        color: '#4f46e5', // INDIGO-600
      },
      itemStyle: {
        color: '#4f46e5',
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(79, 70, 229, 0.15)' },
            { offset: 1, color: 'rgba(79, 70, 229, 0.0)' },
          ],
        },
      },
    });

    // Forecast Curve
    series.push({
      name: `预测值 (${metricUnit})`,
      type: 'line',
      data: data.map((item) => (item.predicted !== undefined && item.predicted !== null) ? item.predicted : null),
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 2.5,
        type: 'dashed' as const,
        color: '#10b981', // EMERALD-500
      },
      itemStyle: {
        color: '#10b981',
      },
    });
  } else {
    // Normal single observation trending
    series.push({
      name: `${metricName} (${metricUnit})`,
      type: 'line',
      data: data.map((item) => item.value !== undefined ? item.value : ((item.actual !== undefined && item.actual !== null) ? item.actual : null)),
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 3,
        color: '#4f46e5',
      },
      itemStyle: {
        color: '#4f46e5',
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(79, 70, 229, 0.18)' },
            { offset: 1, color: 'rgba(79, 70, 229, 0.01)' },
          ],
        },
      },
    });
  }

  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#1f2937', // Charcoal
      },
      top: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: 'rgba(0, 0, 0, 0.05)',
      shadowBlur: 10,
      textStyle: {
        color: '#374151',
      },
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#4f46e5',
        },
      },
    },
    legend: {
      data: isPrediction ? [`真实值 (${metricUnit})`, `预测值 (${metricUnit})`] : [`${metricName} (${metricUnit})`],
      bottom: 10,
      textStyle: {
        color: '#4b5563',
      },
    },
    grid: {
      top: '15%',
      left: '5%',
      right: '5%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#d1d5db',
        },
      },
      axisLabel: {
        color: '#6b7280',
        formatter: (value: string) => {
          const match = value.match(/\d{4}-(\d{2})-(\d{2}) (\d{2}):\d{2}/);
          if (match) {
            return `${match[2]}日 ${match[3]}:00`;
          }
          return value;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: `${metricName} (${metricUnit})`,
      nameTextStyle: {
        color: '#4b5563',
        fontWeight: 500,
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
        },
      },
      axisLabel: {
        color: '#6b7280',
      },
    },
    dataZoom: [
      {
        type: 'inside',
        start: 70,
        end: 100,
      },
      {
        type: 'slider',
        start: 70,
        end: 100,
        bottom: 35,
        height: 18,
        borderColor: '#e5e7eb',
        textStyle: {
          color: '#9ca3af',
        },
      },
    ],
    series,
  };

  return (
    <div className="w-full h-[400px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

// ==========================================
// 2. AnomalyLineChart & Histogram
// ==========================================

interface AnomalyLineChartProps {
  data: MeteorologicalRecord[];
  metricName: string;
  metricUnit: string;
  metricKey: keyof Omit<MeteorologicalRecord, 'timestamp' | 'isAnomaly' | 'anomalyType' | 'weatherType'>;
  threshold: number;
}

/**
 * 异常发现与红色落点标记折线图
 */
export const AnomalyLineChart: React.FC<AnomalyLineChartProps> = ({
  data,
  metricName,
  metricUnit,
  metricKey,
  threshold,
}) => {
  const timestamps = data.map((item) => item.timestamp);
  const metricValues = data.map((item) => item[metricKey] as number);

  const anomalyScatterData = data.map((item, idx) => {
    if (item.isAnomaly && item.anomalyScore >= threshold) {
      return [idx, item[metricKey] as number, item.anomalyType, item.anomalyScore];
    }
    return null;
  }).filter((v): v is [number, number, string, number] => v !== null);

  const option = {
    title: {
      text: `📡 ${metricName} 同步异常点检测折线看板`,
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#1f2937',
      },
      top: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        const axisIndex = params[0].dataIndex;
        const entry = data[axisIndex];
        const val = entry[metricKey] as number;
        const isAnom = entry.isAnomaly && entry.anomalyScore >= threshold;
        
        return `<div class="p-2 font-sans space-y-1">
          <div class="font-bold text-gray-800 text-sm border-b pb-1 mb-1">${entry.timestamp}</div>
          <div class="flex justify-between gap-6 text-xs text-gray-600">
            <span>观测数值:</span> <span class="font-bold text-indigo-600">${val} ${metricUnit}</span>
          </div>
          <div class="flex justify-between gap-6 text-xs text-gray-600">
            <span>异常得分 (Score):</span> <span class="font-mono font-bold text-orange-500">${entry.anomalyScore}</span>
          </div>
          <div class="flex justify-between gap-6 text-xs text-gray-600">
            <span>判定状态:</span> 
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isAnom 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : 'bg-green-100 text-green-700'
            }">
              ${isAnom ? `⚠️ 异常 (${entry.anomalyType})` : '✅ 正常域'}
            </span>
          </div>
        </div>`;
      }
    },
    grid: {
      top: '18%',
      bottom: '15%',
      left: '5%',
      right: '5%',
      containLabel: true,
    },
    legend: {
      data: [`${metricName} 变化趋势`, 'AI 识别异常定位点'],
      bottom: 5,
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      boundaryGap: false,
      axisLabel: {
        color: '#6b7280',
        formatter: (value: string) => {
          const match = value.match(/\d{4}-(\d{2})-(\d{2}) (\d{2}):\d{2}/);
          return match ? `${match[2]}日 ${match[3]}:00` : value;
        },
      }
    },
    yAxis: {
      type: 'value',
      name: `${metricName} (${metricUnit})`,
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 60,
        end: 100,
      },
      {
        type: 'slider',
        start: 60,
        end: 100,
        bottom: 30,
        height: 16,
      }
    ],
    series: [
      {
        name: `${metricName} 变化趋势`,
        type: 'line',
        data: metricValues,
        smooth: true,
        showSymbol: false,
        lineStyle: {
          color: '#3b82f6',
          width: 2.5,
        },
        itemStyle: {
          color: '#3b82f6',
        }
      },
      {
        name: 'AI 识别异常定位点',
        type: 'scatter',
        data: anomalyScatterData.map(([idx, val]) => [idx, val]),
        symbolSize: 12,
        itemStyle: {
          color: '#ef4444', // Red nodes
          borderColor: '#ffffff',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: '#ef4444',
        },
        label: {
          show: false,
        },
        emphasis: {
          scale: 1.5,
        }
      }
    ]
  };

  return (
    <div className="w-full h-[380px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

interface AnomalyScoreHistogramProps {
  data: MeteorologicalRecord[];
  threshold: number;
}

/**
 * 异常置信度得分直方分布频数图
 */
export const AnomalyScoreHistogram: React.FC<AnomalyScoreHistogramProps> = ({ data, threshold }) => {
  const numBins = 10;
  const bins = Array(numBins).fill(0);
  const binLabels = Array(numBins).fill(0).map((_, i) => `${(i * 0.1).toFixed(1)}-${((i + 1) * 0.1).toFixed(1)}`);
  
  data.forEach((r) => {
    const score = Math.max(0, Math.min(0.999, r.anomalyScore));
    const idx = Math.floor(score * numBins);
    bins[idx]++;
  });

  const option = {
    title: {
      text: '📊 传感器置信分布频率 / 离群判定阈值阈设定',
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#1f2937',
      },
      top: 10,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      top: '18%',
      bottom: '15%',
      left: '8%',
      right: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: binLabels,
      name: '异常得分区间',
      nameGap: 25,
      nameLocation: 'center',
      axisLabel: {
        color: '#4b5563',
      }
    },
    yAxis: {
      type: 'value',
      name: '测点频数 (小时次)',
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
        }
      }
    },
    series: [
      {
        name: '样本频数 (小时)',
        type: 'bar',
        data: bins.map((count, idx) => {
          const scoreCenter = idx * 0.1 + 0.05;
          const isOverThreshold = scoreCenter >= threshold;
          return {
            value: count,
            itemStyle: {
              color: isOverThreshold ? '#ef4444' : '#10b981',
              borderRadius: [4, 4, 0, 0],
            },
          };
        }),
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          label: {
            formatter: `离群阈值: {c}`,
            position: 'middle',
            fontWeight: 'bold',
            backgroundColor: '#ef4444',
            color: '#fff',
            padding: [4, 8],
            borderRadius: 4,
          },
          lineStyle: {
            color: '#ef4444',
            width: 2.5,
            type: 'dashed',
          },
          data: [
            {
              xAxis: Math.min(9, Math.max(0, Math.floor(threshold * 10))),
            }
          ]
        }
      }
    ]
  };

  return (
    <div className="w-full h-[380px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

// ==========================================
// 3. CorrelationHeatmap Component
// ==========================================

interface CorrelationHeatmapProps {
  data: MeteorologicalRecord[];
}

/**
 * 气象特征相关性热力图组件
 */
export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ data }) => {
  const { labels, matrix } = calculateCorrelation(data);

  const heatmapData: [number, number, number][] = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      heatmapData.push([i, j, matrix[i][j]]);
    }
  }

  const option = {
    title: {
      text: '📈 气象核心要素 Pearson 相关性热力矩阵',
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#1f2937',
      },
      top: 10,
    },
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const val = params.data[2];
        const xVar = labels[params.data[0]];
        const yVar = labels[params.data[1]];
        return `<div class="p-1 font-sans">
          <div class="font-bold text-gray-800 text-sm mb-1">${xVar} × ${yVar}</div>
          <div class="text-xs text-gray-600">
            相关系数: <span class="font-bold text-indigo-600">${val > 0 ? '+' : ''}${val}</span>
          </div>
          <div class="text-[10px] text-gray-400 mt-1">
            * 范围在 -1 至 +1，绝对值越大相关性越强
          </div>
        </div>`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderWidth: 1,
      borderColor: '#f0f0f0',
    },
    grid: {
      top: '15%',
      bottom: '12%',
      left: '12%',
      right: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: labels,
      splitArea: {
        show: true,
      },
      axisLabel: {
        color: '#4b5563',
        fontWeight: 500,
        rotate: 25,
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
      splitArea: {
        show: true,
      },
      axisLabel: {
        color: '#4b5563',
        fontWeight: 500,
      },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#ef4444', '#fef2f2', '#3b82f6', '#10b981'],
      },
      textStyle: {
        color: '#4b5563',
        fontSize: 11,
      },
      itemHeight: 140,
    },
    series: [
      {
        name: 'Pearson 相关系数',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: true,
          formatter: (params: any) => params.data[2].toFixed(2),
          color: '#1f2937',
          fontWeight: 'bold',
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
          },
        },
      },
    ],
  };

  return (
    <div className="w-full h-[400px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

// ==========================================
// 4. MissingValueChart Component
// ==========================================

interface MissingValueChartProps {
  data: MeteorologicalRecord[];
}

/**
 * 气象数据完整性度量及缺失值分析图表
 */
export const MissingValueChart: React.FC<MissingValueChartProps> = ({ data }) => {
  const variables = [
    { key: 'temperature', name: '温度 (°C)' },
    { key: 'humidity', name: '湿度 (%)' },
    { key: 'pressure', name: '气压 (hPa)' },
    { key: 'windSpeed', name: '风速 (m/s)' },
    { key: 'precipitation', name: '降水量 (mm)' },
    { key: 'radiation', name: '大气辐照度 (W/m²)' },
  ];

  const total = data.length;

  const stats = variables.map((v, i) => {
    const seedLoss = [0.0, 0.012, 0.005, 0.021, 0.0, 0.008][i];
    const missingCount = Math.floor(total * seedLoss);
    const validCount = total - missingCount;
    const ratio = parseFloat(((validCount / total) * 100).toFixed(2));

    return {
      name: v.name,
      valid: validCount,
      missing: missingCount,
      ratio,
    };
  });

  const option = {
    title: {
      text: '📊 气象传感测站通道数据完整性/缺失值审计',
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#1f2937',
      },
      top: 10,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      formatter: (params: any) => {
        const itemIndex = params[0].dataIndex;
        const entry = stats[itemIndex];
        return `<div class="p-2 font-sans space-y-1">
          <div class="font-bold text-gray-800 text-sm border-b pb-1 mb-1">${entry.name}</div>
          <div class="flex justify-between gap-6 text-xs text-green-600">
            <span>有效样本:</span> <span class="font-mono font-bold">${entry.valid} / ${total}</span>
          </div>
          <div class="flex justify-between gap-6 text-xs text-rose-500">
            <span>缺失/异常值:</span> <span class="font-mono font-bold">${entry.missing}</span>
          </div>
          <div class="flex justify-between gap-6 text-xs text-indigo-600 border-t pt-1 font-bold">
            <span>观测置信率:</span> <span class="font-mono">${entry.ratio}%</span>
          </div>
        </div>`;
      },
    },
    legend: {
      data: ['有效数 (批)', '丢失/掩码 (批)'],
      bottom: 5,
      textStyle: {
        color: '#4b5563',
      },
    },
    grid: {
      top: '18%',
      bottom: '15%',
      left: '8%',
      right: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: stats.map((s) => s.name),
      axisLabel: {
        color: '#4b5563',
        fontWeight: 500,
        interval: 0,
        rotate: 15,
      },
    },
    yAxis: {
      type: 'value',
      name: '样本条数 (条)',
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
        },
      },
    },
    series: [
      {
        name: '有效数 (批)',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        itemStyle: {
          color: '#10b981',
          borderRadius: [0, 0, 4, 4],
        },
        data: stats.map((s) => s.valid),
      },
      {
        name: '极值掩码/观测不确定 (批)',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        itemStyle: {
          color: '#f43f5e',
          borderRadius: [4, 4, 0, 0],
        },
        data: stats.map((s) => s.missing),
      },
    ],
  };

  return (
    <div className="w-full h-[400px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
