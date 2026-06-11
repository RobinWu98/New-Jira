"use client";

import { Button, Space, Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { useState } from "react";
import { TaskDetailModal, type TaskDetailData } from "@/components/ProjectForms";
import { PriorityPill, TaskStatusPill } from "@/components/UiControls";

export type WorkItemAntTableRow = {
  id: string;
  title: string;
  projectName?: string;
  assignedTo?: string;
  startLabel: string;
  dueLabel: string;
  dueSort: string;
  priority: string;
  status: string;
  detail: TaskDetailData;
};

type WorkItemsAntTableProps = {
  rows: WorkItemAntTableRow[];
  showAssignedTo?: boolean;
  showProject?: boolean;
  title: string;
};

function priorityRank(priority: string) {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

function statusRank(status: string) {
  return status === "overdue" ? 0 : status === "in_progress" ? 1 : status === "todo" ? 2 : 3;
}

function dateRank(value: string) {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

export function WorkItemsAntTable({ rows, showAssignedTo = false, showProject = false, title }: WorkItemsAntTableProps) {
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [sortedInfo, setSortedInfo] = useState<SorterResult<WorkItemAntTableRow>>({});

  const clearFilters = () => setFilteredInfo({});
  const clearAll = () => {
    setFilteredInfo({});
    setSortedInfo({});
  };

  const handleChange: TableProps<WorkItemAntTableRow>["onChange"] = (_pagination, filters, sorter) => {
    setFilteredInfo(filters);
    setSortedInfo(Array.isArray(sorter) ? sorter[0] ?? {} : sorter);
  };

  const columns: TableColumnsType<WorkItemAntTableRow> = [
    {
      title: "Task",
      dataIndex: "title",
      key: "title",
      render: (_title: string, row) => <TaskDetailModal task={row.detail} />
    },
    ...(showProject
      ? [
          {
            title: "Project",
            dataIndex: "projectName",
            key: "projectName",
            sorter: (left: WorkItemAntTableRow, right: WorkItemAntTableRow) =>
              (left.projectName ?? "").localeCompare(right.projectName ?? ""),
            sortOrder: sortedInfo.columnKey === "projectName" ? sortedInfo.order : null
          }
        ]
      : []),
    ...(showAssignedTo
      ? [
          {
            title: "Assigned To",
            dataIndex: "assignedTo",
            key: "assignedTo",
            sorter: (left: WorkItemAntTableRow, right: WorkItemAntTableRow) =>
              (left.assignedTo ?? "").localeCompare(right.assignedTo ?? ""),
            sortOrder: sortedInfo.columnKey === "assignedTo" ? sortedInfo.order : null
          }
        ]
      : []),
    {
      title: "Start",
      dataIndex: "startLabel",
      key: "startLabel",
      width: 120
    },
    {
      title: "Due Date",
      dataIndex: "dueLabel",
      key: "dueSort",
      sorter: (left, right) => dateRank(left.dueSort) - dateRank(right.dueSort),
      sortOrder: sortedInfo.columnKey === "dueSort" ? sortedInfo.order : null,
      width: 130
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      filters: [
        { text: "High", value: "high" },
        { text: "Medium", value: "medium" },
        { text: "Low", value: "low" }
      ],
      filteredValue: filteredInfo.priority ?? null,
      onFilter: (value, row) => row.priority === value,
      sorter: (left, right) => priorityRank(left.priority) - priorityRank(right.priority),
      sortOrder: sortedInfo.columnKey === "priority" ? sortedInfo.order : null,
      render: (priority: string) => <PriorityPill priority={priority} />,
      width: 130
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Overdue", value: "overdue" },
        { text: "In Progress", value: "in_progress" },
        { text: "Todo", value: "todo" },
        { text: "Done", value: "done" }
      ],
      filteredValue: filteredInfo.status ?? null,
      onFilter: (value, row) => row.status === value,
      sorter: (left, right) => statusRank(left.status) - statusRank(right.status),
      sortOrder: sortedInfo.columnKey === "status" ? sortedInfo.order : null,
      render: (status: string) => <TaskStatusPill status={status} />,
      width: 150
    }
  ];

  return (
    <div className="ant-data-table-shell">
      <div className="ant-data-table-toolbar">
        <strong>
          {title} ({rows.length})
        </strong>
        <Space wrap>
          <Button onClick={clearFilters}>Reset filters</Button>
          <Button onClick={clearAll}>Reset filters and sorters</Button>
        </Space>
      </div>
      <Table<WorkItemAntTableRow>
        bordered
        columns={columns}
        dataSource={rows}
        onChange={handleChange}
        pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: true } : false}
        rowKey="id"
        scroll={{ x: 860 }}
        size="middle"
      />
    </div>
  );
}
