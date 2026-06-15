/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, TabKey } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import { useWeatherStore } from './store/useWeatherStore';

/**
 * Weather Visualizer Main App Application Entry (State-driven SPA Architecture)
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('eda');
  const checkApiHealth = useWeatherStore((s) => s.checkApiHealth);

  useEffect(() => { checkApiHealth(); }, []);

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-gray-800 overflow-hidden font-sans">
      {/* Left Navigator Menu Bar */}
      <Sidebar currentTab={activeTab} onChangeTab={setActiveTab} />

      {/* Content View area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/40">
        {/* Actual sub-views viewport container */}
        <main className="flex-1 overflow-y-auto bg-slate-50/30">
          <Dashboard view={activeTab} />
        </main>
      </div>
    </div>
  );
}
