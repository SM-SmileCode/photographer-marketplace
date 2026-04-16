import CustomerNavbar from "../_components/CustomerNavbar";
import RoleGuardLayout from "./RoleGuardLayout";

function CustomerLayout() {
  return <RoleGuardLayout allowedRole="customer" navbar={<CustomerNavbar />} />;
}

export default CustomerLayout;
