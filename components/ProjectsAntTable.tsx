"use client";

import { Button, Space, Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { useState } from "react";
import { ArchiveProjectForm, EditProjectModal, type ProjectFormData } from "@/components/ProjectForms";
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

  const clearFilters = () => {
    setFilteredInfo({});
  };

  const clearAll = () => {
    setFilteredInfo({});
    setSortedInfo({});
  };

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

  const columns: TableColumnsType<ProjectsAntTableRow> = [
    {
      title: "Project",
      dataIndex: "name",
      key: "name",
      render: (name: string, project) => (
        <a className="project-row-link" href={`/projects/${project.id}`}>
          {name}
        </a>
      )
    },
    {
      title: "Open Days",
      dataIndex: "openDays",
      key: "openDays",
      sorter: (left, right) => left.openDays - right.openDays,
      sortOrder: sortedInfo.columnKey === "openDays" ? sortedInfo.order : null,
      render: (_days: number, project) => project.openDaysLabel,
      width: 130
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      sorter: (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
      sortOrder: sortedInfo.columnKey === "dueDate" ? sortedInfo.order : null,
      render: (_date: string, project) => project.dueDateLabel,
      width: 140
    },
    {
      title: "Tasks",
      dataIndex: "taskCount",
      key: "taskCount",
      width: 100
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Ongoing", value: "active" },
        { text: "Completed", value: "done" }
      ],
      filteredValue: filteredInfo.status ?? null,
      onFilter: (value, project) => project.status === value,
      sorter: (left, right) => left.statusLabel.localeCompare(right.statusLabel),
      sortOrder: sortedInfo.columnKey === "status" ? sortedInfo.order : null,
      render: (_status: ProjectsAntTableRow["status"], project) => <StatusPill status={project.status}>{project.statusLabel}</StatusPill>,
      width: 150
    },
    {
      title: "Actions",
      key: "actions",
      render: (_value, project) =>
        canModify ? (
          <span className="record-actions">
            <EditProjectModal users={users} currentUserId={currentUserId} project={toProjectFormData(project)} />
            <ArchiveProjectForm projectId={project.id} />
          </span>
        ) : (
          <UiButtonLink variant="secondary" href={`/projects/${project.id}`}>
            View
          </UiButtonLink>
        ),
      width: 190
    }
  ];

  return (
    <div className="project-ant-table-shell">
      <div className="project-ant-table-toolbar">
        <strong>Projects ({projects.length})</strong>
        <Space wrap>
          <Button onClick={clearFilters}>Reset filters</Button>
          <Button onClick={clearAll}>Reset filters and sorters</Button>
        </Space>
      </div>
      <Table<ProjectsAntTableRow>
        bordered
        columns={columns}
        dataSource={projects}
        onChange={handleChange}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        rowKey="id"
        scroll={{ x: 860 }}
        size="middle"
      />
    </div>
  );
}
