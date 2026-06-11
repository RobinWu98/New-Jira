"use client";

import { Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { useState } from "react";
import { EditProjectModal, type ProjectFormData } from "@/components/ProjectForms";
import { useResizableAntColumns } from "@/components/ResizableAntColumns";
import { StatusPill, UiButtonLink } from "@/components/UiControls";

export type ProjectsAntTableUser = {
  id: string;
  label: string;
};

export type ProjectsAntTableRow = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  dueDate: string;
  dueDateLabel: string;
  openDays: number;
  openDaysLabel: string;
  ownerId: string;
  status: "active" | "done";
  statusLabel: string;
  taskCount: number;
};

type ProjectsAntTableProps = {
  canModify: boolean;
  currentUserId: string;
  projects: ProjectsAntTableRow[];
  users: ProjectsAntTableUser[];
};

export function ProjectsAntTable({ canModify, currentUserId, projects, users }: ProjectsAntTableProps) {
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [sortedInfo, setSortedInfo] = useState<SorterResult<ProjectsAntTableRow>>({});

  const handleChange: TableProps<ProjectsAntTableRow>["onChange"] = (_pagination, filters, sorter) => {
    setFilteredInfo(filters);
    setSortedInfo(Array.isArray(sorter) ? sorter[0] ?? {} : sorter);
  };

  const toProjectFormData = (project: ProjectsAntTableRow): ProjectFormData => ({
    id: project.id,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    ddl: project.dueDate,
    ownerId: project.ownerId,
    status: project.status
  });

  const baseColumns: TableColumnsType<ProjectsAntTableRow> = [
    {
      title: "Project",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, project) => (
        <a className="project-row-link" href={`/projects/${project.id}`}>
          {name}
        </a>
      ),
      width: 220
    },
    {
      title: "Open Days",
      dataIndex: "openDays",
      key: "openDays",
      align: "center",
      sorter: (left, right) => left.openDays - right.openDays,
      sortOrder: sortedInfo.columnKey === "openDays" ? sortedInfo.order : null,
      render: (_days: number, project) => project.openDaysLabel,
      width: 108
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      align: "center",
      sorter: (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
      sortOrder: sortedInfo.columnKey === "dueDate" ? sortedInfo.order : null,
      render: (_date: string, project) => project.dueDateLabel,
      width: 116
    },
    {
      title: "Tasks",
      dataIndex: "taskCount",
      key: "taskCount",
      align: "center",
      width: 76
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      filters: [
        { text: "Ongoing", value: "active" },
        { text: "Completed", value: "done" }
      ],
      filteredValue: filteredInfo.status ?? null,
      onFilter: (value, project) => project.status === value,
      sorter: (left, right) => left.statusLabel.localeCompare(right.statusLabel),
      sortOrder: sortedInfo.columnKey === "status" ? sortedInfo.order : null,
      render: (_status: ProjectsAntTableRow["status"], project) => <StatusPill status={project.status}>{project.statusLabel}</StatusPill>,
      width: 118
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      render: (_value, project) =>
        canModify ? (
          <span className="record-actions">
            <EditProjectModal users={users} currentUserId={currentUserId} project={toProjectFormData(project)} />
          </span>
        ) : (
          <UiButtonLink variant="secondary" href={`/projects/${project.id}`}>
            View
          </UiButtonLink>
        ),
      width: 92
    }
  ];
  const { columns, scrollX } = useResizableAntColumns(baseColumns, "projects-ant-table-widths", 86);

  return (
    <div className="project-ant-table-shell">
      <Table<ProjectsAntTableRow>
        bordered
        columns={columns}
        dataSource={projects}
        onChange={handleChange}
        pagination={{ pageSize: 10, showSizeChanger: true, size: "small" }}
        rowKey="id"
        scroll={{ x: scrollX }}
        size="small"
        tableLayout="fixed"
      />
    </div>
  );
}
