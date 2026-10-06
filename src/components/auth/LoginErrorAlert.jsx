import { Link } from "react-router-dom";
import { LuArrowRight } from "react-icons/lu";
import Alert from "../ui/Alert";

const PORTAL_LABELS = { school: "School", ngo: "NGO", donor: "Donor", admin: "Admin" };

// Login error, plus a link when the user picked the wrong portal.
const LoginErrorAlert = ({ error, correctPortal }) => {
  if (!error) return null;
  return (
    <Alert tone="danger" className="mb-5">
      {error}
      {correctPortal && (
        <Link to={`/login/${correctPortal}`} className="block mt-1 font-semibold underline underline-offset-2">
          Go to {PORTAL_LABELS[correctPortal]} login <LuArrowRight className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
        </Link>
      )}
    </Alert>
  );
};

export default LoginErrorAlert;
