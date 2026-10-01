// Chart colours, in their fixed order. Validated with the dataviz palette checker against the
// white card surface (light mode; the app has no dark theme): colourblind separation and
// lightness pass. Aqua, yellow and pink are under 3:1 contrast on white, so every chart that
// uses them also shows its values as visible labels (legend counts) and in the report table.
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

// A single series always uses the first colour.
export const SINGLE_SERIES_COLOR = SERIES_COLORS[0];
// Emphasis: the one bar that matters in the series colour, the rest in this recessive gray.
export const DEEMPHASIS_COLOR = "#cbd5e1";
// Meter track: a light step of the same blue ramp, so the whole bar reads as one measure.
export const METER_TRACK_COLOR = "#cde2fb";
// Funding parts taken by another NGO: darker than the track so "taken" never reads as "free"
// (checked against the blue for colourblind separation). Always shown with a text legend.
export const OTHER_PARTY_COLOR = "#94a3b8";
