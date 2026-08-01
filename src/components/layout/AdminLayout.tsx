import {
  Outlet
} from "react-router-dom";

import AdminHeader from "./AdminHeader";

import "./AdminLayout.css";

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <AdminHeader />

      <div className="admin-layout-content">
        <Outlet />
      </div>
    </div>
  );
}