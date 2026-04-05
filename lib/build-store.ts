// In-memory store for active build directories
// Keyed by buildId, value is the absolute temp directory path
export const BUILD_DIRS = new Map<string, string>();
