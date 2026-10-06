import { createElement } from "react";
import { categoryIcon } from "../../constants/infrastructureCategories";

/** The Lucide icon for a project category. Decorative: the category name is always shown with it. */
const CategoryIcon = ({ category, className = "w-5 h-5" }) =>
  // createElement because the icon is looked up from a fixed table, not created here.
  createElement(categoryIcon(category), { className, "aria-hidden": true });

export default CategoryIcon;
