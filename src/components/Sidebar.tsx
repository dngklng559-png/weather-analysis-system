/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, TrendingUp, ShieldAlert, Sparkles, CloudSun, RefreshCw } from 'lucide-react';
import { useWeatherStore } from '../store/useWeatherStore';

export type TabKey = 'eda' | 'predict' | 'anomaly' | 'classify';

interface SidebarProps {
  currentTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
}

/**
 * 侧边栏导航组件 (State-driven tabs selector)
 */
export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onChangeTab }) => {
  const resetToDefault = useWeatherStore((state) => state.resetToDefault);

  const menuItems = [
    {
      key: 'eda' as const,
      name: '数据探索 EDA',
      desc: '数据上传与深度探索',
      icon: LayoutDashboard,
    },
    {
      key: 'predict' as const,
      name: '前瞻预测分析',
      desc: '时序模型数值回归',
      icon: TrendingUp,
    },
    {
      key: 'anomaly' as const,
      name: '智能异常检测',
      desc: '传感器漂移与孤立森林',
      icon: ShieldAlert,
    },
    {
      key: 'classify' as const,
      name: '极端事件分类',
      desc: '气象类别审计与下载',
      icon: Sparkles,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold text-lg animate-pulse">
            <CloudSun size={24} />
          </div>
          <div>
            <h1 className="font-sans font-bold tracking-tight text-white text-base">
              气象智脑可视化
            </h1>
            <span className="text-[10px] text-slate-400 font-mono">
              METEO BRAIN v2.5
            </span>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
          分析工作台
        </span>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChangeTab(item.key)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left group cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-medium'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon size={20} className="shrink-0 mt-0.5" />
              <div>
                <NavTitle title={item.name} />
                <div className="text-[10px] text-slate-400 group-hover:text-slate-300 mt-0.5">
                  {item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile / Quick Reset Button */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('是否重置数据集为出厂默认值？')) {
              resetToDefault();
            }
          }}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-700/60 hover:border-indigo-500/60 text-slate-400 hover:text-white text-xs font-medium cursor-pointer transition-all bg-slate-900/50 hover:bg-slate-800/50 active:scale-95"
        >
          <RefreshCw size={14} className="animate-spin-hover" />
          <span>重设初始基准数据</span>
        </button>

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-800/60 pt-2 px-1">
          <span>SERVER ONLINE</span>
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
        </div>
      </div>
    </aside>
  );
};

// Extracted internal subcomponent for typescript alignment
const NavTitle: React.FC<{ title: string }> = ({ title }) => {
  return <div className="text-sm">{title}</div>;
};
