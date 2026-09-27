const INFRASTRUCTURE_CATEGORY_DEFINITIONS = [
    { id: "Classroom Development", schoolLabel: "Classroom", infrastructureLabel: "Classroom Development", label: "🏫 Classroom Development", icon: "🏫" },
    { id: "Library", schoolLabel: "Library", infrastructureLabel: "Library", label: "📚 Library", icon: "📚" },
    { id: "Computer Lab", schoolLabel: "Computer Lab", infrastructureLabel: "Computer Lab", label: "💻 Computer Lab", icon: "💻" },
    { id: "Science Laboratory", schoolLabel: "Science Lab", infrastructureLabel: "Science Lab", label: "🔬 Science Laboratory", icon: "🔬" },
    { id: "Drinking Water", schoolLabel: "Drinking Water", infrastructureLabel: "Drinking Water", label: "🚰 Drinking Water", icon: "🚰" },
    { id: "Electricity", schoolLabel: "Electricity", infrastructureLabel: "Electricity", label: "⚡ Electricity", icon: "⚡" },
    { id: "Toilets & Sanitation", schoolLabel: "Toilets", infrastructureLabel: "Toilets & Sanitation", label: "🚻 Toilets & Sanitation", icon: "🚻" },
    { id: "Playground", schoolLabel: "Playground", infrastructureLabel: "Playground", label: "⚽ Playground", icon: "⚽" },
    { id: "Campus Development", schoolLabel: "Campus", infrastructureLabel: "Campus Development", label: "🌳 Campus Development", icon: "🌳", schoolIcon: "🏛️" },
    { id: "Mid-Day Meal", schoolLabel: "Mid-Day Meal", infrastructureLabel: "Mid-Day Meal", label: "🍛 Mid-Day Meal", icon: "🍛", schoolIcon: "🍱" },
    { id: "Transportation", schoolLabel: "Transportation", infrastructureLabel: "Transportation", label: "🚌 Transportation", icon: "🚌" },
    { id: "Inclusive Education", schoolLabel: "Inclusive Education", infrastructureLabel: "Inclusive Education", label: "♿ Inclusive Education", icon: "♿" },
    { id: "Arts & Culture", schoolLabel: "Arts", infrastructureLabel: "Arts & Culture", label: "🎨 Arts & Culture", icon: "🎨" },
    { id: "Digital Learning", schoolLabel: "Digital Learning", infrastructureLabel: "Digital Learning", label: "🎓 Digital Learning", icon: "🎓", schoolIcon: "📱" },
    { id: "Health & Wellness", schoolLabel: "Health", infrastructureLabel: "Health & Wellness", label: "🩺 Health & Wellness", icon: "🩺" },
    { id: "Other Infrastructure", schoolLabel: "Other", infrastructureLabel: "Other Infrastructure", label: "📦 Other Infrastructure", icon: "📦" },
];

export const INFRASTRUCTURE_CATEGORIES = INFRASTRUCTURE_CATEGORY_DEFINITIONS;

// Compatibility exports preserve the existing consumers' string and object shapes.
export const INFRA_16_CATEGORIES = INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ schoolLabel }) => schoolLabel);
export const INFRA_CATEGORIES = ["All", ...INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ infrastructureLabel }) => infrastructureLabel)];
export const CREATE_NEED_CATEGORIES = INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ id, label }) => ({ id, label }));
export const INFRA_CATEGORY_ICONS = Object.fromEntries(
    INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ schoolLabel, icon, schoolIcon }) => [schoolLabel, schoolIcon || icon])
);
// Keyed by the category id a real project stores (PROJECT_CATEGORIES in shared/projectRules.js).
export const PROJECT_CATEGORY_ICONS = Object.fromEntries(
    INFRASTRUCTURE_CATEGORY_DEFINITIONS.map(({ id, icon, schoolIcon }) => [id, schoolIcon || icon])
);
