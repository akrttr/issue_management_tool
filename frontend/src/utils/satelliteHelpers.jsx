/**
 * Convert UTC timestamp to local readable string
 */
export const formatUTCTime = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
};

/**
 * Calculate time until next event
 */
export const getTimeUntil = (futureTime) => {
  if (!futureTime) return null;
  const now = new Date();
  const future = new Date(futureTime);
  const diffMs = future - now;
  
  if (diffMs <= 0) return 'In progress';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

/**
 * Determine if a pass is upcoming, current, or past
 */
export const getPassStatus = (pass) => {
  const now = new Date();
  const start = new Date(pass.aos_time);
  const end = new Date(pass.los_time);
  
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'current';
};

/**
 * Get color for pass based on elevation
 */
export const getPassColor = (maxElevation) => {
  if (maxElevation >= 60) return '#00ff00'; // Excellent
  if (maxElevation >= 40) return '#7fff00'; // Good
  if (maxElevation >= 20) return '#ffaa00'; // Fair
  return '#ff5555'; // Poor
};