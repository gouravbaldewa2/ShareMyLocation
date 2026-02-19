export interface SavedFleet {
  id: string;
  name: string;
  adminCode: string;
  createdAt: string;
  expiresAt: string;
}

const STORAGE_KEY = 'sharemylocation_fleets';

export function getSavedFleets(): SavedFleet[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const fleets: SavedFleet[] = JSON.parse(stored);
    const now = new Date();
    const validFleets = fleets.filter(f => new Date(f.expiresAt) > now);

    if (validFleets.length !== fleets.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validFleets));
    }

    return validFleets;
  } catch {
    return [];
  }
}

export function saveFleet(fleet: SavedFleet): void {
  try {
    const fleets = getSavedFleets();
    const existingIndex = fleets.findIndex(f => f.id === fleet.id);

    if (existingIndex >= 0) {
      fleets[existingIndex] = fleet;
    } else {
      fleets.push(fleet);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fleets));
  } catch {
    console.error('Failed to save fleet to localStorage');
  }
}

export function removeFleet(id: string): void {
  try {
    const fleets = getSavedFleets();
    const filtered = fleets.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    console.error('Failed to remove fleet from localStorage');
  }
}

export function addFleetByAdminCode(fleet: SavedFleet): void {
  saveFleet(fleet);
}
