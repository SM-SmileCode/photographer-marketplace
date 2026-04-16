import AdminNavbar from "../_components/AdminNavbar";
import RoleGuardLayout from "./RoleGuardLayout";

function AdminLayout() {
  return <RoleGuardLayout allowedRole="admin" navbar={<AdminNavbar />} />;
}

export default AdminLayout;
