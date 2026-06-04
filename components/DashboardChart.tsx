"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type ChartDatum = {
  name: string;
  value: number;
  color: string;
};

type DashboardChartProps = {
  statusData: ChartDatum[];
  priorityData: ChartDatum[];
};

export function DashboardChart({ statusData, priorityData }: DashboardChartProps) {
  return (
    <div className="dashboard-chart-grid">
      <div className="chart-panel" aria-label="Task status chart">
        <h3>Status Split</h3>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} stroke="#6b5744" strokeWidth={2}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-panel" aria-label="Task priority chart">
        <h3>Priority Load</h3>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={priorityData} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#d4c2aa" strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke="#3d332a" />
              <YAxis allowDecimals={false} stroke="#3d332a" />
              <Tooltip />
              <Bar dataKey="value" stroke="#6b5744" strokeWidth={2}>
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
