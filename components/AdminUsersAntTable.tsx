"use client";

import { Table } from "antd";
import type { TableColumnsType } from "antd";
import { useState } from "react";
import { AdminArchiveUserForm, AdminUpdateUserForm } from "@/components/AuthForms";
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
  const columns: TableColumnsType<AdminUserRow> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (left, right) => (left.name || "").localeCompare(right.name || ""),
      render: (name: string | null) => name || "No name"
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      sorter: (left, right) => left.email.localeCompare(right.email)
    },
    {
      title: "Department",
      dataIndex: "category",
      key: "category",
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
      width: 120
    }
  ];

  return (
    <>
      <div className="ant-data-table-shell">
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
          pagination={users.length > 10 ? { pageSize: 10, showSizeChanger: true } : false}
          rowKey="id"
          scroll={{ x: 860 }}
          size="middle"
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
