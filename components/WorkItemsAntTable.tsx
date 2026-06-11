"use client";

import { Button, Space, Table } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { useState } from "react";
import { TaskDetailModal, type TaskDetailData } from "@/components/ProjectForms";
import { useResizableAntColumns } from "@/components/ResizableAntColumns";
import { PriorityPill, TaskStatusPill } from "@/components/UiControls";

export type WorkItemAntTableRow = {
  id: string;
  title: string;
  projectName?: string;
  assignedTo?: string;
  openDays?: number | null;
  startLabel: string;
  dueLabel: string;
  dueSort: string;
  priority: string;
  status: string;
  detail: TaskDetailData;
};

type WorkItemsAntTableProps = {
  enableProjectSort?: boolean;
  groupByProject?: boolean;
  rows: WorkItemAntTableRow[];
  showResetFilters?: boolean;
  showAssignedTo?: boolean;
  showOpenDays?: boolean;
  showProject?: boolean;
  showStart?: boolean;
  showToolbarTitle?: boolean;
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

function openDaysRank(value: number | null | undefined) {
  return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
}

function compareRows(left: WorkItemAntTableRow, right: WorkItemAntTableRow, columnKey: React.Key | undefined) {
  if (columnKey === "assignedTo") {
    return (left.assignedTo ?? "").localeCompare(right.assignedTo ?? "");
  }

  if (columnKey === "dueSort") {
    return dateRank(left.dueSort) - dateRank(right.dueSort);
  }

  if (columnKey === "openDays") {
    return openDaysRank(left.openDays) - openDaysRank(right.openDays);
  }

  if (columnKey === "priority") {
    return priorityRank(left.priority) - priorityRank(right.priority);
  }

  if (columnKey === "status") {
    return statusRank(left.status) - statusRank(right.status);
  }

  return 0;
}

export function WorkItemsAntTable({
  enableProjectSort = true,
  groupByProject = false,
  rows,
  showResetFilters = true,
  showAssignedTo = false,
  showOpenDays = false,
  showProject = false,
  showStart = true,
  showToolbarTitle = true,
  title
}: WorkItemsAntTableProps) {
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

  const filteredRows = groupByProject
    ? rows.filter((row) => {
        const priorityFilter = filteredInfo.priority;
        const statusFilter = filteredInfo.status;
        const matchesPriority = priorityFilter?.length ? priorityFilter.includes(row.priority) : true;
        const matchesStatus = statusFilter?.length ? statusFilter.includes(row.status) : true;

        return matchesPriority && matchesStatus;
      })
    : rows;
  const groupedRows = groupByProject
    ? Array.from(
        filteredRows
          .reduce((groups, row) => {
            const projectName = row.projectName || "No project";
            groups.set(projectName, [...(groups.get(projectName) ?? []), row]);
            return groups;
          }, new Map<string, WorkItemAntTableRow[]>())
          .entries()
      )
        .map(([projectName, group]) => {
          if (!sortedInfo.order) {
            return { projectName, rows: group };
          }

          const sortedGroup = [...group].sort((left, right) => compareRows(left, right, sortedInfo.columnKey));
          return {
            projectName,
            rows: sortedInfo.order === "descend" ? sortedGroup.reverse() : sortedGroup
          };
        })
        .sort((left, right) => {
          if (!sortedInfo.order) {
            return 0;
          }

          const leftRepresentative = left.rows[0];
          const rightRepresentative = right.rows[0];
          const rank = compareRows(leftRepresentative, rightRepresentative, sortedInfo.columnKey);
          const orderedRank = sortedInfo.order === "descend" ? -rank : rank;

          return orderedRank || left.projectName.localeCompare(right.projectName);
        })
        .flatMap((group) => group.rows)
    : filteredRows;
  const projectRowSpans = new Map<string, number>();

  if (groupByProject) {
    let index = 0;

    while (index < groupedRows.length) {
      const projectName = groupedRows[index]?.projectName || "No project";
      let count = 1;

      while (groupedRows[index + count] && (groupedRows[index + count].projectName || "No project") === projectName) {
        count += 1;
      }

      projectRowSpans.set(groupedRows[index].id, count);

      for (let offset = 1; offset < count; offset += 1) {
        projectRowSpans.set(groupedRows[index + offset].id, 0);
      }

      index += count;
    }
  }

  const taskColumn = {
    title: "Task",
    dataIndex: "title",
    key: "title",
    width: 260,
    render: (_title: string, row: WorkItemAntTableRow) => <TaskDetailModal task={row.detail} />
  };
  const projectColumn = {
    title: "Project",
    dataIndex: "projectName",
    key: "projectName",
    width: 220,
    render: (projectName: string | undefined, row: WorkItemAntTableRow) => {
      const projectLink = row.detail.projectId ? (
        <a href={`/projects/${row.detail.projectId}`}>{projectName || "No project"}</a>
      ) : (
        projectName || "No project"
      );

      return groupByProject
        ? {
            children: projectLink,
            props: {
              rowSpan: projectRowSpans.get(row.id) ?? 1
            }
          }
        : projectLink;
    },
    ...(enableProjectSort && !groupByProject
      ? {
          sorter: (left: WorkItemAntTableRow, right: WorkItemAntTableRow) =>
            (left.projectName ?? "").localeCompare(right.projectName ?? ""),
          sortOrder: sortedInfo.columnKey === "projectName" ? sortedInfo.order : null
        }
      : {})
  };
  const leadingColumns: TableColumnsType<WorkItemAntTableRow> =
    showProject && groupByProject ? [projectColumn, taskColumn] : showProject ? [taskColumn, projectColumn] : [taskColumn];
  const baseColumns: TableColumnsType<WorkItemAntTableRow> = [
    ...leadingColumns,
    ...(showAssignedTo
      ? [
          {
            title: "Assigned To",
            dataIndex: "assignedTo",
            key: "assignedTo",
            width: 180,
            sorter: groupByProject
              ? true
              : (left: WorkItemAntTableRow, right: WorkItemAntTableRow) =>
                  (left.assignedTo ?? "").localeCompare(right.assignedTo ?? ""),
            sortOrder: sortedInfo.columnKey === "assignedTo" ? sortedInfo.order : null
          }
        ]
      : []),
    ...(showStart
      ? [
          {
            title: "Start",
            dataIndex: "startLabel",
            key: "startLabel",
            width: 120
          }
        ]
      : []),
    ...(showOpenDays
      ? [
          {
            title: "Open Days",
            dataIndex: "openDays",
            key: "openDays",
            render: (openDays: number | null | undefined) => (typeof openDays === "number" ? openDays : "-"),
            sorter: groupByProject
              ? true
              : (left: WorkItemAntTableRow, right: WorkItemAntTableRow) =>
                  openDaysRank(left.openDays) - openDaysRank(right.openDays),
            sortOrder: sortedInfo.columnKey === "openDays" ? sortedInfo.order : null,
            width: 120
          }
        ]
      : []),
    {
      title: "Due Date",
      dataIndex: "dueLabel",
      key: "dueSort",
      sorter: groupByProject ? true : (left, right) => dateRank(left.dueSort) - dateRank(right.dueSort),
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
      onFilter: groupByProject ? undefined : (value, row) => row.priority === value,
      sorter: groupByProject ? true : (left, right) => priorityRank(left.priority) - priorityRank(right.priority),
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
      onFilter: groupByProject ? undefined : (value, row) => row.status === value,
      sorter: groupByProject ? true : (left, right) => statusRank(left.status) - statusRank(right.status),
      sortOrder: sortedInfo.columnKey === "status" ? sortedInfo.order : null,
      render: (status: string) => <TaskStatusPill status={status} />,
      width: 150
    }
  ];
  const { columns, scrollX } = useResizableAntColumns(baseColumns, `work-items-ant-table-widths-${title}`, 92);

  return (
    <div className="ant-data-table-shell">
      <div className={`ant-data-table-toolbar${showToolbarTitle ? "" : " align-end"}`}>
        {showToolbarTitle ? (
          <strong>
            {title} ({rows.length})
          </strong>
        ) : null}
        <Space wrap>
          {showResetFilters ? <Button onClick={clearFilters}>Reset filters</Button> : null}
          <Button onClick={clearAll}>Reset filters and sorters</Button>
        </Space>
      </div>
      <Table<WorkItemAntTableRow>
        bordered
        columns={columns}
        dataSource={groupedRows}
        onChange={handleChange}
        pagination={groupByProject ? false : rows.length > 10 ? { pageSize: 10, showSizeChanger: true } : false}
        rowKey="id"
        scroll={{ x: scrollX }}
        size="middle"
        tableLayout="fixed"
      />
    </div>
  );
}
