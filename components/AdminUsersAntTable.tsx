"use client";

import { Table } from "antd";
import type { TableColumnsType } from "antd";
import { useState } from "react";
import { AdminArchiveUserForm, AdminUpdateUserForm } from "@/components/AuthForms";
import { useResizableAntColumns } from "@/components/ResizableAntColumns";
import { UiButton } from "@/components/UiControls";

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  category: string | null;
};

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const baseColumns: TableColumnsType<AdminUserRow> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 170,
      sorter: (left, right) => (left.name || "").localeCompare(right.name || ""),
      render: (name: string | null) => name || "No name"
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 230,
      sorter: (left, right) => left.email.localeCompare(right.email)
    },
    {
      title: "Department",
      dataIndex: "category",
      key: "category",
      width: 140,
      filters: [
        { text: "IT", value: "IT" },
        { text: "Sales", value: "Sales" },
        { text: "Support", value: "Support" },
        { text: "Business", value: "Business" },
        { text: "Unassigned", value: "" }
      ],
      onFilter: (value, user) => (user.category || "") === value,
      sorter: (left, right) => (left.category || "").localeCompare(right.category || ""),
      render: (category: string | null) => category || "Unassigned"
    },
    {
      title: "Level",
      dataIndex: "role",
      key: "role",
      width: 112,
      filters: [
        { text: "Admin", value: "admin" },
        { text: "Manager", value: "manager" },
        { text: "Staff", value: "staff" }
      ],
      onFilter: (value, user) => user.role === value,
      sorter: (left, right) => left.role.localeCompare(right.role)
    },
    {
      title: "Archive",
      key: "archive",
      render: (_value, user) => (
        <span onClick={(event) => event.stopPropagation()}>
          <AdminArchiveUserForm userId={user.id} role={user.role} />
        </span>
      ),
      width: 104
    }
  ];
  const { columns, scrollX } = useResizableAntColumns(baseColumns, "admin-users-ant-table-widths-compact-v2", 84);

  return (
    <>
      <div className="ant-data-table-shell admin-users-table-shell">
        <Table<AdminUserRow>
          bordered
          columns={columns}
          dataSource={users}
          onRow={(user) => ({
            onClick: () => setSelectedUser(user),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedUser(user);
              }
            },
            tabIndex: 0
          })}
          pagination={false}
          rowKey="id"
          scroll={{ x: scrollX }}
          size="small"
          tableLayout="fixed"
        />
      </div>
      {selectedUser ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedUser(null)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-user-${selectedUser.id}-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id={`edit-user-${selectedUser.id}-title`}>Edit User</h2>
                <p className="small">Change user details and assign a manager or staff role.</p>
              </div>
              <UiButton variant="secondary" type="button" onClick={() => setSelectedUser(null)}>
                Close
              </UiButton>
            </div>
            <AdminUpdateUserForm user={selectedUser} showRole={true} />
          </div>
        </div>
      ) : null}
    </>
  );
}
