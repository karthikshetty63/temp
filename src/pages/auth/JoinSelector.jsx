import { LuHandHeart, LuHeartHandshake, LuSchool } from "react-icons/lu";
import AccountChooser from "../../components/auth/AccountChooser";

const accountTypes = [
  { key: "school", icon: LuSchool, title: "School", description: "Register your school and request support", href: "/join/school", continueLabel: "Register a school" },
  { key: "ngo", icon: LuHeartHandshake, title: "NGO partner", description: "Partner with schools and verify their progress", href: "/join/ngo", continueLabel: "Register an NGO" },
  { key: "donor", icon: LuHandHeart, title: "Donor", description: "Fund verified needs in government schools", href: "/join/donor", continueLabel: "Create a donor account" },
];

const JoinSelector = () => (
  <AccountChooser
    title="Create your account"
    description="Choose the option that describes you best."
    legend="Account type"
    options={accountTypes}
    headerLink={{ prompt: "Already have an account?", label: "Sign in", href: "/login" }}
    note="Every account is verified by our team before activation, so have your documents ready."
  />
);

export default JoinSelector;
