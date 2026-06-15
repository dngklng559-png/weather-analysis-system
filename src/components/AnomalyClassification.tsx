/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { AnomalyWeatherAnalysis, AnomalyWeatherClassification, AnomalyWeatherStats } from '../types';
import { getAnomalyTypeColor, getSeverityColor, getAnomalyTypeDescription } from '../utils/anomalyClassifier';

interface AnomalyClassificationCardProps {
  classification: AnomalyWeatherClassification;
}

export const AnomalyClassificationCard: React.FC<AnomalyClassificationCardProps> = ({ classification }) => {
  const { type, severity, confidence, indicators, timestamp } = classification;
  const typeColor = getAnomalyTypeColor(type);
  const severityColor = getSeverityColor(severity);
  
  const indicatorDisplay = Object.entries(indicators).map(([key, value]) => {
    const labelMap: Record<string, string> = {
      temperature: '温度',
      windSpeed: '风速',
      precipitation: '降水量',
      humidity: '湿度',
      pressure: '气压'
    };
    const unitMap: Record<string, string> = {
      temperature: '°C',
      windSpeed: 'm/s',
      precipitation: 'mm',
      humidity: '%',
      pressure: 'hPa'
    };
    return (
      <div key={key} className="flex justify-between items-center text-sm">
        <span className="text-gray-500">{labelMap[key] || key}</span>
        <span className="font-mono font-bold text-gray-700">{value} {unitMap[key] || ''}</span>
      </div>
    );
  });

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: typeColor }}
          />
          <span className="font-semibold text-gray-800">{type}</span>
        </div>
        <span 
          className="px-2 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: `${severityColor}20`, color: severityColor }}
        >
          {severity}
        </span>
      </div>
      
      <div className="text-sm text-gray-500 mb-3">
        {timestamp}
      </div>
      
      <div className="space-y-2 mb-3">
        {indicatorDisplay}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">置信度</span>
        <span className="font-mono font-bold text-indigo-600">{(confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

interface AnomalyStatsChartProps {
  statistics: AnomalyWeatherStats[];
}

export const AnomalyStatsChart: React.FC<AnomalyStatsChartProps> = ({ statistics }) => {
  const topStats = statistics.slice(0, 6);
  
  const option = {
    title: {
      text: '异常天气类型分布统计',
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#1f2937',
      },
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      formatter: (params: any) => {
        const stat = topStats.find(s => s.type === params.name);
        return `<div class="p-2 font-sans">
          <div class="font-bold text-gray-800 text-sm">${params.name}</div>
          <div class="text-xs text-gray-600 mt-1">
            数量: ${params.value} 次<br/>
            占比: ${params.percent.toFixed(1)}%<br/>
            平均等级: ${stat?.avgSeverity.toFixed(1)}
          </div>
        </div>`;
      },
    },
    legend: {
      orient: 'horizontal',
      bottom: 10,
      textStyle: {
        color: '#4b5563',
      },
    },
    series: [
      {
        name: '异常天气',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11,
          color: '#4b5563',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
        },
        data: topStats.map(stat => ({
          value: stat.count,
          name: stat.type,
          itemStyle: {
            color: getAnomalyTypeColor(stat.type),
          },
        })),
      },
    ],
  };

  return (
    <div className="w-full h-[350px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

interface AnomalyTimeDistributionChartProps {
  timeDistribution: { hour: number; count: number }[];
}

export const AnomalyTimeDistributionChart: React.FC<AnomalyTimeDistributionChartProps> = ({ timeDistribution }) => {
  const option = {
    title: {
      text: '异常天气小时分布',
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
      borderWidth: 1,
      borderColor: '#e5e7eb',
    },
    grid: {
      top: '18%',
      bottom: '12%',
      left: '8%',
      right: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: timeDistribution.map(d => `${d.hour}:00`),
      name: '时段',
      axisLabel: {
        color: '#4b5563',
        interval: 2,
      },
    },
    yAxis: {
      type: 'value',
      name: '异常次数',
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
        },
      },
    },
    series: [
      {
        name: '异常次数',
        type: 'bar',
        data: timeDistribution.map(d => ({
          value: d.count,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#06b6d4' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  };

  return (
    <div className="w-full h-[300px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

interface AnomalyWeeklyTrendChartProps {
  weeklyTrend: { day: string; count: number }[];
}

export const AnomalyWeeklyTrendChart: React.FC<AnomalyWeeklyTrendChartProps> = ({ weeklyTrend }) => {
  const option = {
    title: {
      text: '异常天气周分布趋势',
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
    },
    grid: {
      top: '18%',
      bottom: '12%',
      left: '8%',
      right: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: weeklyTrend.map(d => d.day),
      name: '星期',
      axisLabel: {
        color: '#4b5563',
      },
    },
    yAxis: {
      type: 'value',
      name: '异常次数',
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
        },
      },
    },
    series: [
      {
        name: '异常次数',
        type: 'line',
        smooth: true,
        data: weeklyTrend.map(d => d.count),
        lineStyle: {
          width: 3,
          color: '#8b5cf6',
        },
        itemStyle: {
          color: '#8b5cf6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 8,
      },
    ],
  };

  return (
    <div className="w-full h-[300px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <ReactECharts option={option} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

interface AnomalyClassificationPanelProps {
  analysis: AnomalyWeatherAnalysis;
}

export const AnomalyClassificationPanel: React.FC<AnomalyClassificationPanelProps> = ({ analysis }) => {
  const { totalAnomalies, classifiedRecords, statistics, timeDistribution, weeklyTrend } = analysis;
  
  const anomalyRecords = classifiedRecords.filter(r => r.type !== '无异常');
  const recentAnomalies = anomalyRecords.slice(-6);
  
  const trendColors: Record<string, string> = {
    increasing: '#ef4444',
    decreasing: '#22c55e',
    stable: '#6b7280'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">异常天气分类分析</h2>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-indigo-700">共检测 {totalAnomalies} 次异常</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnomalyStatsChart statistics={statistics} />
        </div>
        
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">异常类型统计</h3>
          <div className="space-y-3">
            {statistics.slice(0, 5).map((stat, index) => (
              <div key={stat.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: getAnomalyTypeColor(stat.type) }}
                  />
                  <span className="text-sm text-gray-700">{stat.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{stat.count}</span>
                  <span 
                    className="text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{ 
                      backgroundColor: `${trendColors[stat.trend]}20`, 
                      color: trendColors[stat.trend] 
                    }}
                  >
                    {stat.trend === 'increasing' ? '↑ 上升' : stat.trend === 'decreasing' ? '↓ 下降' : '→ 稳定'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnomalyTimeDistributionChart timeDistribution={timeDistribution} />
        <AnomalyWeeklyTrendChart weeklyTrend={weeklyTrend} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">最近异常记录</h3>
          <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            查看全部
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentAnomalies.map((classification, index) => (
            <AnomalyClassificationCard 
              key={index} 
              classification={classification} 
            />
          ))}
          {recentAnomalies.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-400">
              暂无异常记录
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">异常类型说明</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {['高温', '低温', '大风', '暴雨', '暴雪', '寒潮', '雷暴', '雾霾'].map(type => (
            <div 
              key={type} 
              className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: getAnomalyTypeColor(type as any) }}
                />
                <span className="font-medium text-gray-700 text-sm">{type}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">
                {getAnomalyTypeDescription(type as any)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};