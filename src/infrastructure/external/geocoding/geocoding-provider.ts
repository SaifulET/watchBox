import { ExternalServiceError } from "../../../common/errors/app-error.js";

export type PostalCodeLookup = {
  postalCode: string;
  countryCode: string;
  city: string | null;
  state: string | null;
  displayName: string | null;
};

type NominatimReverseResponse = {
  display_name?: string;
  address?: {
    postcode?: string;
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
};

type CachedPostalCodeLookup = {
  value: PostalCodeLookup;
  expiresAt: number;
};

const geocodeCache = new Map<string, CachedPostalCodeLookup>();
const inFlightGeocodeRequests = new Map<string, Promise<PostalCodeLookup>>();
const geocodeCacheTtlMs = 24 * 60 * 60 * 1000;
const geocodeTimeoutMs = 1_500;

const coordinateCacheKey = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(3)},${longitude.toFixed(3)}`;

export interface GeocodingProvider {
  reversePostalCode(latitude: number, longitude: number): Promise<PostalCodeLookup>;
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  public async reversePostalCode(latitude: number, longitude: number): Promise<PostalCodeLookup> {
    const key = coordinateCacheKey(latitude, longitude);
    const cached = geocodeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const pending = inFlightGeocodeRequests.get(key);
    if (pending) {
      return pending;
    }

    const request = this.fetchReversePostalCode(latitude, longitude)
      .then((value) => {
        geocodeCache.set(key, {
          value,
          expiresAt: Date.now() + geocodeCacheTtlMs
        });
        return value;
      })
      .finally(() => {
        inFlightGeocodeRequests.delete(key);
      });
    inFlightGeocodeRequests.set(key, request);
    return request;
  }

  private async fetchReversePostalCode(latitude: number, longitude: number): Promise<PostalCodeLookup> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", latitude.toString());
    url.searchParams.set("lon", longitude.toString());
    url.searchParams.set("addressdetails", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), geocodeTimeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "WatchBox API <https://api.mywatchbox.net>"
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExternalServiceError("Reverse geocoding timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new ExternalServiceError(`Reverse geocoding failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as NominatimReverseResponse;
    const address = payload.address ?? {};
    const postalCode = address?.postcode?.trim();
    const countryCode = address?.country_code?.trim().toUpperCase();
    if (!postalCode || !countryCode) {
      throw new ExternalServiceError("Reverse geocoding did not return a postal code.");
    }

    return {
      postalCode,
      countryCode,
      city: address.city ?? address.town ?? address.village ?? address.municipality ?? null,
      state: address.state ?? null,
      displayName: payload.display_name ?? null
    };
  }
}
