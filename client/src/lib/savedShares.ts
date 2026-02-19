export interface SavedShare {
  id: string;
  link: string;
  name: string;
  isLive: boolean;
  createdAt: string;
  expiresAt: string;
}

const STORAGE_KEY = 'sharemylocation_shares';

export function getSavedShares(): SavedShare[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const shares: SavedShare[] = JSON.parse(stored);
    const now = new Date();
    const validShares = shares.filter(share => new Date(share.expiresAt) > now);
    
    if (validShares.length !== shares.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validShares));
    }
    
    return validShares;
  } catch {
    return [];
  }
}

export function saveShare(share: SavedShare): void {
  try {
    const shares = getSavedShares();
    const existingIndex = shares.findIndex(s => s.id === share.id);
    
    if (existingIndex >= 0) {
      shares[existingIndex] = share;
    } else {
      shares.push(share);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
  } catch {
    console.error('Failed to save share to localStorage');
  }
}

export function removeShare(id: string): void {
  try {
    const shares = getSavedShares();
    const filtered = shares.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    console.error('Failed to remove share from localStorage');
  }
}

export function updateShareLiveStatus(id: string, isLive: boolean): void {
  try {
    const shares = getSavedShares();
    const share = shares.find(s => s.id === id);
    if (share) {
      share.isLive = isLive;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
    }
  } catch {
    console.error('Failed to update share status');
  }
}
