"use client";

import { Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { SorterResult } from "antd/es/table/interface";
import { useState } from "react";
import { EditProjectModal, type ProjectFormData, ViewProjectModal } from "@/components/ProjectForms";
import { useResizableAntColumns } from "@/components/ResizableAntColumns";
import { StatusPill } from "@/components/UiControls";

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
  rawStatus: "active" | "done";
  status: "active" | "overdue" | "done";
  statusLabel: string;
  completedTaskCount: number;
  remainingTaskCount: number;
  taskCount: number;
  lastComment: string;
  lastCommentCreatedAt: number;
  lastCommentTitle: string;
};

type ProjectsAntTableProps = {
  canEdit: boolean;
  canManage: boolean;
  currentUserId: string;
  projects: ProjectsAntTableRow[];
  users: ProjectsAntTableUser[];
};

export function ProjectsAntTable({ canEdit, canManage, currentUserId, projects, users }: ProjectsAntTableProps) {
  const [sortedInfo, setSortedInfo] = useState<SorterResult<ProjectsAntTableRow>>({});

  const handleChange: TableProps<ProjectsAntTableRow>["onChange"] = (_pagination, _filters, sorter) => {
    setSortedInfo(Array.isArray(sorter) ? sorter[0] ?? {} : sorter);
  };

  const toProjectFormData = (project: ProjectsAntTableRow): ProjectFormData => ({
    id: project.id,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    ddl: project.dueDate,
    ownerId: project.ownerId,
    status: project.rawStatus,
    completedTaskCount: project.completedTaskCount,
    remainingTaskCount: project.remainingTaskCount,
    totalTaskCount: project.taskCount
  });

  const baseColumns: TableColumnsType<ProjectsAntTableRow> = [
    {
      title: "Project",
      dataIndex: "name",
      key: "name",
      align: "left",
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
      align: "left",
      sorter: (left, right) => left.openDays - right.openDays,
      sortOrder: sortedInfo.columnKey === "openDays" ? sortedInfo.order : null,
      render: (_days: number, project) => project.openDaysLabel,
      width: 108
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      align: "left",
      sorter: (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
      sortOrder: sortedInfo.columnKey === "dueDate" ? sortedInfo.order : null,
      render: (_date: string, project) => project.dueDateLabel,
      width: 116
    },
    {
      title: "Tasks",
      key: "tasks",
      align: "left",
      render: (_value, project) => (
        <span title={`${project.completedTaskCount} done of ${project.taskCount} total tasks`}>
          {project.completedTaskCount}/{project.taskCount}
        </span>
      ),
      sorter: (left, right) =>
        left.completedTaskCount - right.completedTaskCount || left.taskCount - right.taskCount,
      sortOrder: sortedInfo.columnKey === "tasks" ? sortedInfo.order : null,
      width: 92
    },
    {
      title: "Last Comment",
      dataIndex: "lastComment",
      key: "lastComment",
      align: "left",
      ellipsis: true,
      render: (lastComment: string, project) => (
        <span className="project-last-comment" title={project.lastCommentTitle}>
          {lastComment}
        </span>
      ),
      sorter: (left, right) => left.lastCommentCreatedAt - right.lastCommentCreatedAt,
      sortOrder: sortedInfo.columnKey === "lastComment" ? sortedInfo.order : null,
      width: 230
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "left",
      render: (_status: ProjectsAntTableRow["status"], project) => <StatusPill status={project.status}>{project.statusLabel}</StatusPill>,
      width: 118
    },
    {
      title: "Actions",
      key: "actions",
      align: "left",
      render: (_value, project) =>
        canEdit ? (
          <EditProjectModal
            users={users}
            currentUserId={currentUserId}
            project={toProjectFormData(project)}
            showActions={canManage}
            triggerKind="antd"
          />
        ) : (
          <ViewProjectModal users={users} currentUserId={currentUserId} project={toProjectFormData(project)} />
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
        pagination={false}
        rowKey="id"
        scroll={{ x: scrollX }}
        size="small"
        tableLayout="fixed"
      />
    </div>
  );
}
