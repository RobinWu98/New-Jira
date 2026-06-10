"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type ChartDatum = {
  name: string;
  value: number;
  color: string;
};

type DashboardChartProps = {
  statusData: ChartDatum[];
};

export function DashboardChart({ statusData }: DashboardChartProps) {
  return (
    <div className="dashboard-chart-grid single-chart">
      <div className="chart-panel" aria-label="Task status chart">
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={116}
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={3}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  border: "1px solid #172b4d",
                  borderRadius: 8,
                  boxShadow: "0 8px 20px rgba(9, 30, 66, 0.18)",
                  color: "#091e42",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "12px 14px"
                }}
                itemStyle={{ fontSize: 18, fontWeight: 800 }}
                wrapperStyle={{ zIndex: 20 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
