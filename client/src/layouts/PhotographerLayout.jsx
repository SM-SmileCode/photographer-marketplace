import PhotographerNavbar from "../_components/PhotographerNavbar";
import RoleGuardLayout from "./RoleGuardLayout";

function PhotographerLayout() {
  return (
    <RoleGuardLayout
      allowedRole="photographer"
      navbar={<PhotographerNavbar />}
    />
  );
}

export default PhotographerLayout;
