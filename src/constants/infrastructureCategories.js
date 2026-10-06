import {
    LuAccessibility, LuBus, LuCircleEllipsis, LuFence, LuFlaskConical, LuGlassWater, LuLibrary, LuMonitor,
    LuMonitorPlay, LuPalette, LuPresentation, LuStethoscope, LuToilet, LuUtensils, LuVolleyball, LuZap,
} from "react-icons/lu";

// One Lucide icon per category, for what the money pays for.
const INFRASTRUCTURE_CATEGORY_DEFINITIONS = [
    { id: "Classroom Development", schoolLabel: "Classroom", infrastructureLabel: "Classroom Development", icon: LuPresentation },
    { id: "Library", schoolLabel: "Library", infrastructureLabel: "Library", icon: LuLibrary },
    { id: "Computer Lab", schoolLabel: "Computer Lab", infrastructureLabel: "Computer Lab", icon: LuMonitor },
    { id: "Science Laboratory", schoolLabel: "Science Lab", infrastructureLabel: "Science Lab", icon: LuFlaskConical },
    { id: "Drinking Water", schoolLabel: "Drinking Water", infrastructureLabel: "Drinking Water", icon: LuGlassWater },
    { id: "Electricity", schoolLabel: "Electricity", infrastructureLabel: "Electricity", icon: LuZap },
    { id: "Toilets & Sanitation", schoolLabel: "Toilets", infrastructureLabel: "Toilets & Sanitation", icon: LuToilet },
    { id: "Playground", schoolLabel: "Playground", infrastructureLabel: "Playground", icon: LuVolleyball },
    { id: "Campus Development", schoolLabel: "Campus", infrastructureLabel: "Campus Development", icon: LuFence },
    { id: "Mid-Day Meal", schoolLabel: "Mid-Day Meal", infrastructureLabel: "Mid-Day Meal", icon: LuUtensils },
    { id: "Transportation", schoolLabel: "Transportation", infrastructureLabel: "Transportation", icon: LuBus },
    { id: "Inclusive Education", schoolLabel: "Inclusive Education", infrastructureLabel: "Inclusive Education", icon: LuAccessibility },
    { id: "Arts & Culture", schoolLabel: "Arts", infrastructureLabel: "Arts & Culture", icon: LuPalette },
    { id: "Digital Learning", schoolLabel: "Digital Learning", infrastructureLabel: "Digital Learning", icon: LuMonitorPlay },
    { id: "Health & Wellness", schoolLabel: "Health", infrastructureLabel: "Health & Wellness", icon: LuStethoscope },
    { id: "Other Infrastructure", schoolLabel: "Other", infrastructureLabel: "Other Infrastructure", icon: LuCircleEllipsis },
];

export const INFRASTRUCTURE_CATEGORIES = INFRASTRUCTURE_CATEGORY_DEFINITIONS;

// Compatibility exports preserve the existing consumers' string and object shapes.
export const INFRA_16_CATEGORIES = INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ schoolLabel }) => schoolLabel);
export const INFRA_CATEGORIES = ["All", ...INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ infrastructureLabel }) => infrastructureLabel)];
export const CREATE_NEED_CATEGORIES = INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ id }) => ({ id, label: id }));
export const INFRA_CATEGORY_ICONS = Object.fromEntries(INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ schoolLabel, icon }) => [schoolLabel, icon]));
// Keyed by the category id a real project stores (PROJECT_CATEGORIES in shared/projectRules.js).
export const PROJECT_CATEGORY_ICONS = Object.fromEntries(INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ id, icon }) => [id, icon]));

/** The icon component for a project's category; unknown categories get the "Other" icon. */
export const categoryIcon = (category) => PROJECT_CATEGORY_ICONS[category] || LuCircleEllipsis;
