import { MeteorologicalRecord, AnomalyWeatherType, AnomalyWeatherClassification, AnomalyWeatherAnalysis, AnomalyWeatherStats } from '../types';

const CLASSIFICATION_RULES = {
  highTemperature: {
    thresholds: [35, 38, 40],
    labels: ['轻度', '中度', '重度'] as const,
    description: '高温预警'
  },
  lowTemperature: {
    thresholds: [-10, -15, -20],
    labels: ['轻度', '中度', '重度'] as const,
    description: '低温预警'
  },
  strongWind: {
    thresholds: [17, 24, 32],
    labels: ['轻度', '中度', '重度'] as const,
    description: '大风预警'
  },
  heavyRain: {
    thresholds: [12, 24, 48],
    labels: ['轻度', '中度', '重度'] as const,
    description: '暴雨预警'
  },
  heavySnow: {
    thresholds: [5, 10, 20],
    labels: ['轻度', '中度', '重度'] as const,
    description: '暴雪预警'
  },
  coldWave: {
    thresholds: [8, 12, 16],
    labels: ['轻度', '中度', '重度'] as const,
    description: '寒潮预警'
  },
  thunderstorm: {
    thresholds: [40, 60, 80],
    labels: ['轻度', '中度', '重度'] as const,
    description: '雷暴预警'
  },
  fog: {
    thresholds: [500, 200, 50],
    labels: ['轻度', '中度', '重度'] as const,
    description: '雾霾预警'
  }
};

export function classifyAnomalyWeather(record: MeteorologicalRecord): AnomalyWeatherClassification {
  const { temperature, windSpeed, precipitation, humidity, pressure, timestamp } = record;
  
  const classifications: Array<{
    type: AnomalyWeatherType;
    severity: '轻度' | '中度' | '重度';
    confidence: number;
    indicators: Record<string, number>;
  }> = [];

  if (temperature >= CLASSIFICATION_RULES.highTemperature.thresholds[0]) {
    const [t1, t2, t3] = CLASSIFICATION_RULES.highTemperature.thresholds;
    let severity: '轻度' | '中度' | '重度' = '轻度';
    let confidence = 0.7;
    
    if (temperature >= t3) {
      severity = '重度';
      confidence = 0.95;
    } else if (temperature >= t2) {
      severity = '中度';
      confidence = 0.85;
    } else if (temperature >= t1) {
      severity = '轻度';
      confidence = 0.75;
    }
    
    classifications.push({
      type: '高温',
      severity,
      confidence,
      indicators: { temperature }
    });
  }

  if (temperature <= CLASSIFICATION_RULES.lowTemperature.thresholds[0]) {
    const [t1, t2, t3] = CLASSIFICATION_RULES.lowTemperature.thresholds;
    let severity: '轻度' | '中度' | '重度' = '轻度';
    let confidence = 0.7;
    
    if (temperature <= t3) {
      severity = '重度';
      confidence = 0.95;
    } else if (temperature <= t2) {
      severity = '中度';
      confidence = 0.85;
    } else if (temperature <= t1) {
      severity = '轻度';
      confidence = 0.75;
    }
    
    classifications.push({
      type: '低温',
      severity,
      confidence,
      indicators: { temperature }
    });
  }

  if (windSpeed >= CLASSIFICATION_RULES.strongWind.thresholds[0]) {
    const [t1, t2, t3] = CLASSIFICATION_RULES.strongWind.thresholds;
    let severity: '轻度' | '中度' | '重度' = '轻度';
    let confidence = 0.7;
    
    if (windSpeed >= t3) {
      severity = '重度';
      confidence = 0.95;
    } else if (windSpeed >= t2) {
      severity = '中度';
      confidence = 0.85;
    } else if (windSpeed >= t1) {
      severity = '轻度';
      confidence = 0.75;
    }
    
    classifications.push({
      type: '大风',
      severity,
      confidence,
      indicators: { windSpeed }
    });
  }

  if (precipitation >= CLASSIFICATION_RULES.heavyRain.thresholds[0] && temperature > 0) {
    const [t1, t2, t3] = CLASSIFICATION_RULES.heavyRain.thresholds;
    let severity: '轻度' | '中度' | '重度' = '轻度';
    let confidence = 0.7;
    
    if (precipitation >= t3) {
      severity = '重度';
      confidence = 0.95;
    } else if (precipitation >= t2) {
      severity = '中度';
      confidence = 0.85;
    } else if (precipitation >= t1) {
      severity = '轻度';
      confidence = 0.75;
    }
    
    classifications.push({
      type: '暴雨',
      severity,
      confidence,
      indicators: { precipitation, temperature }
    });
  }

  if (precipitation >= CLASSIFICATION_RULES.heavySnow.thresholds[0] && temperature <= 0) {
    const [t1, t2, t3] = CLASSIFICATION_RULES.heavySnow.thresholds;
    let severity: '轻度' | '中度' | '重度' = '轻度';
    let confidence = 0.7;
    
    if (precipitation >= t3) {
      severity = '重度';
      confidence = 0.95;
    } else if (precipitation >= t2) {
      severity = '中度';
      confidence = 0.85;
    } else if (precipitation >= t1) {
      severity = '轻度';
      confidence = 0.75;
    }
    
    classifications.push({
      type: '暴雪',
      severity,
      confidence,
      indicators: { precipitation, temperature }
    });
  }

  if (humidity > 90 && pressure < 1000) {
    classifications.push({
      type: '雷暴',
      severity: '轻度',
      confidence: 0.7,
      indicators: { humidity, pressure }
    });
  }

  if (humidity > 95 && visibilityLow(humidity, pressure)) {
    classifications.push({
      type: '雾霾',
      severity: '中度',
      confidence: 0.8,
      indicators: { humidity, pressure }
    });
  }

  if (classifications.length === 0) {
    return {
      timestamp,
      type: '无异常',
      severity: '轻度',
      indicators: {},
      confidence: 1.0
    };
  }

  classifications.sort((a, b) => b.confidence - a.confidence);
  
  return {
    timestamp,
    type: classifications[0].type,
    severity: classifications[0].severity,
    indicators: classifications[0].indicators,
    confidence: classifications[0].confidence
  };
}

function visibilityLow(humidity: number, pressure: number): boolean {
  return humidity > 90 && pressure < 1005;
}

export function analyzeAnomalyWeather(records: MeteorologicalRecord[]): AnomalyWeatherAnalysis {
  const classifiedRecords = records.map(classifyAnomalyWeather);
  
  const anomalyRecords = classifiedRecords.filter(r => r.type !== '无异常');
  const totalAnomalies = anomalyRecords.length;

  const typeCounts = new Map<AnomalyWeatherType, number>();
  const typeSeverities = new Map<AnomalyWeatherType, number[]>();
  const typeTimestamps = new Map<AnomalyWeatherType, string[]>();
  
  anomalyRecords.forEach(record => {
    typeCounts.set(record.type, (typeCounts.get(record.type) || 0) + 1);
    const severityValue = record.severity === '轻度' ? 1 : record.severity === '中度' ? 2 : 3;
    typeSeverities.set(record.type, [...(typeSeverities.get(record.type) || []), severityValue]);
    typeTimestamps.set(record.type, [...(typeTimestamps.get(record.type) || []), record.timestamp]);
  });

  const statistics: AnomalyWeatherStats[] = [];
  typeCounts.forEach((count, type) => {
    const severities = typeSeverities.get(type) || [];
    const avgSeverity = severities.length > 0 
      ? severities.reduce((a, b) => a + b, 0) / severities.length 
      : 0;
    const timestamps = typeTimestamps.get(type) || [];
    const trend = calculateTrend(timestamps);
    
    statistics.push({
      type,
      count,
      percentage: totalAnomalies > 0 ? (count / totalAnomalies) * 100 : 0,
      avgSeverity,
      trend,
      recentOccurrences: timestamps.slice(-5)
    });
  });

  statistics.sort((a, b) => b.count - a.count);

  const timeDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: anomalyRecords.filter(r => {
      const hourOfDay = new Date(r.timestamp).getHours();
      return hourOfDay === hour;
    }).length
  }));

  const dayOrder = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weeklyTrend = dayOrder.map((day, index) => ({
    day,
    count: anomalyRecords.filter(r => {
      const dayOfWeek = new Date(r.timestamp).getDay();
      return dayOfWeek === index;
    }).length
  }));

  return {
    totalAnomalies,
    classifiedRecords,
    statistics,
    timeDistribution,
    weeklyTrend
  };
}

function calculateTrend(timestamps: string[]): 'increasing' | 'decreasing' | 'stable' {
  if (timestamps.length < 2) return 'stable';
  
  timestamps.sort();
  
  const recent = timestamps.slice(-7);
  const earlier = timestamps.slice(0, Math.min(7, timestamps.length));
  
  const recentDays = new Set(recent.map(t => t.split(' ')[0])).size;
  const earlierDays = new Set(earlier.map(t => t.split(' ')[0])).size;
  
  if (recentDays > earlierDays + 1) return 'increasing';
  if (recentDays < earlierDays - 1) return 'decreasing';
  return 'stable';
}

export function getAnomalyTypeDescription(type: AnomalyWeatherType): string {
  const descriptions: Record<AnomalyWeatherType, string> = {
    '高温': '气温达到或超过35°C，可能导致中暑等健康风险',
    '低温': '气温低于-10°C，可能导致冻伤等健康风险',
    '大风': '风速达到或超过17m/s，可能影响出行和设施安全',
    '暴雨': '24小时降水量达到或超过12mm，可能引发洪涝灾害',
    '暴雪': '24小时降雪量达到或超过5mm，可能影响交通和供电',
    '寒潮': '气温急剧下降，24小时降温幅度达到或超过8°C',
    '雷暴': '伴有雷电的强对流天气，可能引发雷击事故',
    '雾霾': '能见度低，空气质量差，可能影响呼吸系统健康',
    '无异常': '当前天气状况正常，无异常预警'
  };
  return descriptions[type];
}

export function getSeverityColor(severity: '轻度' | '中度' | '重度'): string {
  const colors: Record<string, string> = {
    '轻度': '#22c55e',
    '中度': '#eab308',
    '重度': '#ef4444'
  };
  return colors[severity];
}

export function getAnomalyTypeColor(type: AnomalyWeatherType): string {
  const colors: Record<AnomalyWeatherType, string> = {
    '高温': '#ef4444',
    '低温': '#3b82f6',
    '大风': '#f97316',
    '暴雨': '#06b6d4',
    '暴雪': '#a855f7',
    '寒潮': '#0ea5e9',
    '雷暴': '#eab308',
    '雾霾': '#6b7280',
    '无异常': '#22c55e'
  };
  return colors[type];
}