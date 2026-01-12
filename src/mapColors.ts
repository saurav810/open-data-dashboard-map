/**
 * Map color constants - single source of truth for city and county colors
 * Using organization secondary palette to avoid political red/blue associations
 */
export const MAP_COLORS = {
  city: {
    fill: '#00a86d',      // Green for city point markers
    stroke: '#007a4f',    // Darker green for city marker borders
  },
  county: {
    fill: '#b737c3',      // Purple for county area polygons
    stroke: '#7f1f88',    // Darker purple for county borders
  },
} as const
