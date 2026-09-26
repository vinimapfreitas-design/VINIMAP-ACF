/**
 * Date and Time Utilities for Brasília Timezone (America/Sao_Paulo)
 *
 * Ensures all incoming and outgoing dates, times, and timestamps from Supabase, the server,
 * or system inputs are handled and rendered correctly, independent of the hosting environment
 * or local client system timezone.
 */

/**
 * Gets a Date object whose local fields match Brasília timezone.
 * Used when we need to do date comparisons or field extractions (like .getHours(), .getDate()).
 */
export function getBrasiliaDate(dateInput?: Date | string | number | null): Date {
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // If it's a date-only string YYYY-MM-DD, construct with noon time to avoid any timezone midnight boundary jumps
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.split('-').map(Number);
      return new Date(yyyy, mm - 1, dd, 12, 0, 0);
    }
    // If it's DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split('/').map(Number);
      return new Date(yyyy, mm - 1, dd, 12, 0, 0);
    }
  }
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return new Date();
  
  try {
    // Converts UTC or another local time into a representation where the local fields match America/Sao_Paulo
    const tzString = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    return new Date(tzString);
  } catch (e) {
    console.warn("getBrasiliaDate failed, falling back to local Date object", e);
    return d;
  }
}

/**
 * Formats a date to pt-BR date string (DD/MM/YYYY) in Brasília timezone.
 * Accurately preserves date-only strings (e.g. YYYY-MM-DD or DD/MM/YYYY) without UTC midnight shifts.
 */
export function formatToBrasiliaDate(dateInput?: Date | string | number | null): string {
  if (!dateInput && dateInput !== 0) return '';
  
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '';
    
    // If already in DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    
    // If in pure ISO date format YYYY-MM-DD (DO NOT allow new Date('YYYY-MM-DD') to treat as UTC midnight!)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.split('-');
      return `${dd}/${mm}/${yyyy}`;
    }
    
    // If in YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm without Z or timezone offset
    const matchYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?$/);
    if (matchYMD && !trimmed.includes('Z') && !trimmed.includes('+') && !trimmed.match(/-\d{2}:\d{2}$/)) {
      const [, yyyy, mm, dd] = matchYMD;
      return `${dd}/${mm}/${yyyy}`;
    }

    // If starts with DD/MM/YYYY
    const matchDMY = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (matchDMY) {
      return `${matchDMY[1]}/${matchDMY[2]}/${matchDMY[3]}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    return d.toLocaleDateString('pt-BR');
  }
}

/**
 * Formats a date to pt-BR time string (HH:MM or HH:MM:SS) in Brasília timezone
 */
export function formatToBrasiliaTime(dateInput?: Date | string | number | null, withSeconds = false): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false
    }).format(d);
  } catch (e) {
    return d.toLocaleTimeString('pt-BR');
  }
}

/**
 * Formats a date to ISO date string (YYYY-MM-DD) in Brasília timezone.
 * Correctly avoids UTC midnight rollback for date-only strings.
 */
export function formatToBrasiliaISODate(dateInput?: Date | string | number | null): string {
  if (!dateInput && dateInput !== 0) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '';
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // If DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    // If string starts with YYYY-MM-DD without Z or offset
    const matchYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchYMD && !trimmed.includes('Z') && !trimmed.includes('+') && !trimmed.match(/-\d{2}:\d{2}$/)) {
      return `${matchYMD[1]}-${matchYMD[2]}-${matchYMD[3]}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month}-${day}`;
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) in Brasília timezone
 */
export function getTodayISO(): string {
  return formatToBrasiliaISODate(new Date());
}

/**
 * Returns yesterday's ISO date string (YYYY-MM-DD) in Brasília timezone
 */
export function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatToBrasiliaISODate(d);
}

/**
 * Formats a date/time to pt-BR string (DD/MM/YYYY HH:MM:SS) in Brasília timezone
 */
export function formatToBrasiliaDateTime(dateInput?: Date | string | number | null, withSeconds = true): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false
    }).format(d);
  } catch (e) {
    return d.toLocaleString('pt-BR');
  }
}

/**
 * Normalizes any incoming date string from Supabase, spreadsheets, or system inputs
 * and ensures it returns a valid formatted date in America/Sao_Paulo (DD/MM/YYYY).
 * Prevents UTC-midnight date degradation (e.g. 2026-09-02 -> 01/09/2026).
 */
export function normalizeIncomingDateToBrasilia(dateStr?: string | null): string {
  if (!dateStr) return formatToBrasiliaDate(new Date());
  const trimmed = dateStr.trim();
  if (!trimmed) return formatToBrasiliaDate(new Date());
  
  // 1. If already in DD/MM/YYYY HH:MM:SS or DD/MM/YYYY HH:MM format
  if (/^\d{2}\/\d{2}\/\d{4}(\s+\d{2}:\d{2}(:\d{2})?)?$/.test(trimmed)) {
    return trimmed;
  }
  
  // 2. If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // 3. If in pure ISO date format YYYY-MM-DD (e.g. 2026-09-02)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  // 4. If in YYYY-MM-DD HH:MM(:SS) format without timezone
  const isoWithTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
  if (isoWithTimeMatch && !trimmed.includes('Z') && !trimmed.includes('+') && !trimmed.match(/-\d{2}:\d{2}$/)) {
    const [, yyyy, mm, dd, timePart] = isoWithTimeMatch;
    return `${dd}/${mm}/${yyyy} ${timePart}`;
  }
  
  // 5. If it contains a space (like YYYY-MM-DD HH:MM:SS or similar)
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx !== -1) {
    const datePart = trimmed.slice(0, spaceIdx);
    const timePart = trimmed.slice(spaceIdx + 1);
    const parsedDate = parseToISODate(datePart);
    if (parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
      const [yyyy, mm, dd] = parsedDate.split('-');
      return `${dd}/${mm}/${yyyy} ${timePart}`;
    }
  }
  
  // 6. Try parsing with formatToBrasiliaDate
  const formatted = formatToBrasiliaDate(trimmed);
  if (formatted) {
    return formatted;
  }
  
  // 7. Robust manual fallback for DD/MM/YYYY combinations
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${day}/${month}/${year}`;
    }
  }
  
  return formatToBrasiliaDate(new Date());
}

/**
 * Normalizes any incoming time string (e.g. HH:MM or HH:MM:SS or full ISO)
 * and returns it in HH:MM format in Brasília timezone.
 */
export function normalizeIncomingTimeToBrasilia(timeStr?: string | null): string {
  if (!timeStr) return formatToBrasiliaTime(new Date());
  const trimmed = timeStr.trim();
  
  // If it matches HH:MM or HH:MM:SS already, we can keep it, but we also ensure it's validated
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5); // Return HH:MM
  }
  
  // If it's a full Date or ISO string
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return formatToBrasiliaTime(d);
  }
  
  return trimmed;
}

/**
 * Highly robust parser that converts any date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)
 * into a valid ISO YYYY-MM-DD date string.
 * It has smart auto-detection for Brazilian (DD/MM/YYYY) and American (MM/DD/YYYY) formats.
 */
export function parseToISODate(str: string | undefined | null, fallbackISO?: string): string {
  const defaultFallback = fallbackISO || formatToBrasiliaISODate(new Date());
  
  if (!str) return defaultFallback;
  let trimmed = str.trim();
  
  // Extract date portion if it has a time portion (separated by T or space)
  if (trimmed.includes('T')) {
    trimmed = trimmed.split('T')[0].trim();
  } else {
    trimmed = trimmed.split(/\s+/)[0].trim();
  }
  
  // 1. If it's already YYYY-MM-DD
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  
  // 2. If it contains '/' (like DD/MM/YYYY or MM/DD/YYYY)
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      
      let dayStr = parts[0].trim();
      let monthStr = parts[1].trim();
      let yearStr = parts[2].trim();
      
      if (yearStr.length === 2) {
        yearStr = `20${yearStr}`;
      }
      
      // Smart detection of American MM/DD/YYYY vs Brazilian DD/MM/YYYY format
      // If the second part (middle) is greater than 12, it is definitely a day (making it MM/DD/YYYY)
      if (p1 > 12) {
        dayStr = parts[1].trim();
        monthStr = parts[0].trim();
      } 
      // If the first part is greater than 12, it is definitely a day (making it DD/MM/YYYY)
      else if (p0 > 12) {
        dayStr = parts[0].trim();
        monthStr = parts[1].trim();
      }
      // If both are <= 12, we default to Brazilian DD/MM/YYYY since it is a Brazilian App.
      
      const day = dayStr.padStart(2, '0');
      const month = monthStr.padStart(2, '0');
      
      return `${yearStr}-${month}-${day}`;
    }
  }
  
  // 3. If it contains '-' (like DD-MM-YYYY or YYYY-MM-DD)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        
        let dayStr = parts[0].trim();
        let monthStr = parts[1].trim();
        let yearStr = parts[2].trim();
        
        if (yearStr.length === 2) {
          yearStr = `20${yearStr}`;
        }
        
        if (p1 > 12) {
          dayStr = parts[1].trim();
          monthStr = parts[0].trim();
        } else if (p0 > 12) {
          dayStr = parts[0].trim();
          monthStr = parts[1].trim();
        }
        
        const day = dayStr.padStart(2, '0');
        const month = monthStr.padStart(2, '0');
        return `${yearStr}-${month}-${day}`;
      }
    }
  }
  
  // Fallback to standard JS parsing if it can parse it
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    const yyyy = parsedDate.getFullYear();
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  return defaultFallback;
}
