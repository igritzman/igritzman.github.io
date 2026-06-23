import { transitTimeMachineImages } from "../data/transitTimeMachineImages";
import type { TransitTimeMachineEntry, TransitTimeMachineEraKey } from "../data/transitTimeMachineImages";

export function getTransitTimeMachineByCity(cityName: string): TransitTimeMachineEntry | undefined {
  const normalized = cityName.trim().toLocaleLowerCase();
  return transitTimeMachineImages.find((entry) => entry.city.toLocaleLowerCase() === normalized);
}

export function getMissingTransitTimeMachineAssets() {
  return transitTimeMachineImages.flatMap((entry) => entry.eras
    .filter((era) => era.needsAsset || !era.imageUrl)
    .map((era) => ({
      city: entry.city,
      country: entry.country,
      system: entry.system,
      era: era.key as TransitTimeMachineEraKey,
      year: era.year,
      searchQueries: era.searchQueries,
      preferredSources: era.preferredSources,
    })));
}

export function getTransitTimeMachineCompletion(cityName: string): number {
  const entry = getTransitTimeMachineByCity(cityName);
  if (!entry || entry.eras.length === 0) return 0;
  const complete = entry.eras.filter((era) => Boolean(era.imageUrl) && !era.needsAsset).length;
  return Math.round((complete / entry.eras.length) * 100);
}
