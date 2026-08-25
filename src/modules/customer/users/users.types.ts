export type CustomerProfile = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  emailVerified: boolean;
  darkMode: boolean;
  latitude?: number;
  longitude?: number;
  phone?: string;
  country?: string;
  avatarKey?: string;
  avatarUrl?: string;
  preferences: {
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CustomerStats = {
  listings: number;
  orders: number;
  savedSearches: number;
  watchlists: number;
};

export type DarkModePreference = {
  darkMode: boolean;
};

export type CustomerAvatar = {
  avatarKey: string | null;
  avatarUrl: string | null;
};

export type NearbyCustomerProfile = CustomerProfile & {
  distanceMeters: number;
};
