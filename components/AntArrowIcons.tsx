"use client";

import { DownOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";

export function DropdownArrowIcon() {
  return <DownOutlined className="ant-arrow-icon" aria-hidden="true" />;
}

export function DisclosureArrowIcons() {
  return (
    <span className="disclosure-arrow-icons" aria-hidden="true">
      <RightOutlined className="disclosure-arrow-icon disclosure-arrow-icon-closed" />
      <DownOutlined className="disclosure-arrow-icon disclosure-arrow-icon-open" />
    </span>
  );
}

export function RightArrowIcon() {
  return <RightOutlined className="ant-arrow-icon" aria-hidden="true" />;
}

export function LeftArrowIcon() {
  return <LeftOutlined className="ant-arrow-icon" aria-hidden="true" />;
}
