/**
 * Utility functions for handling GMT-5 timezone conversions
 * This ensures consistent date handling regardless of server timezone
 */

const GMT_5_OFFSET_MINUTES = 5 * 60; // 5 hours in minutes

/**
 * Convert a local date string (in GMT-5) to UTC Date object
 * @param localDateString - Date string in format 'YYYY-MM-DD' representing GMT-5 date
 * @returns UTC Date object
 */
export function convertGMT5ToUTC(localDateString: string): Date {
  // Parse date components to avoid timezone interpretation issues
  const [year, month, day] = localDateString.split('-').map(Number);
  // Create date in GMT-5 timezone (as if it were UTC)
  const localDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // GMT-5 means we need to add 5 hours to convert local time to UTC
  return new Date(localDate.getTime() + GMT_5_OFFSET_MINUTES * 60000);
}

/**
 * Convert a UTC Date object to GMT-5 local date
 * @param utcDate - UTC Date object
 * @returns Date object representing GMT-5 time
 */
export function convertUTCToGMT5(utcDate: Date): Date {
  // GMT-5 means we need to subtract 5 hours from UTC to get local time
  return new Date(utcDate.getTime() - GMT_5_OFFSET_MINUTES * 60000);
}

/**
 * Get UTC date range for a GMT-5 date (start and end of day)
 * @param localDateString - Date string in format 'YYYY-MM-DD' representing GMT-5 date
 * @returns Object with startUTC and endUTC Date objects
 */
export function getUTCRangeForGMT5Date(localDateString: string): { startUTC: Date; endUTC: Date } {
  // Parse date components to avoid timezone interpretation issues
  const [year, month, day] = localDateString.split('-').map(Number);
  
  // Start of day in GMT-5 (00:00:00)
  const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const startUTC = new Date(startLocal.getTime() + GMT_5_OFFSET_MINUTES * 60000);
  
  // End of day in GMT-5 (23:59:59.999)
  const endLocal = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const endUTC = new Date(endLocal.getTime() + GMT_5_OFFSET_MINUTES * 60000);
  
  return { startUTC, endUTC };
}

/**
 * Get current date in GMT-5 timezone formatted as YYYY-MM-DD
 * @returns Date string in GMT-5 timezone
 */
export function getCurrentGMT5Date(): string {
  const now = new Date();
  const localDate = convertUTCToGMT5(now);
  return localDate.toISOString().slice(0, 10);
}

/**
 * Format a UTC date to display in GMT-5 timezone
 * @param utcDate - UTC Date object
 * @param format - Format string (default: 'YYYY-MM-DD')
 * @returns Formatted date string in GMT-5 timezone
 */
export function formatUTCDateAsGMT5(utcDate: Date, format: string = 'yyyy-MM-dd'): string {
  const localDate = convertUTCToGMT5(utcDate);
  
  if (format === 'yyyy-MM-dd') {
    return localDate.toISOString().slice(0, 10);
  }
  
  // For other formats, you might want to use date-fns format function
  // This is a basic implementation
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
} 