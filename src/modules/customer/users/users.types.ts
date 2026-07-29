export type CustomerProfile = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  emailVerified: boolean;
  darkMode: boolean;
  phone?: string;
  country?: string;
  avatarKey?: string;
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
