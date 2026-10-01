import * as Location from 'expo-location';

export class LocationError extends Error {}

/** Rejects if the promise takes too long (e.g. a location prompt nobody answers). */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new LocationError(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/** The phone's position and a readable place name. Gives up after 10 seconds. */
export function currentPosition(): Promise<{ lat: number; lon: number; name: string }> {
  return withTimeout(findPosition(), 10000, 'Could not get your location. Add a place in Settings instead.');
}

async function findPosition(): Promise<{ lat: number; lon: number; name: string }> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) throw new LocationError('Location permission was denied. Add a place in Settings instead.');
  const pos = (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  const { latitude: lat, longitude: lon } = pos.coords;
  let name = 'Your location';
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    name = place?.city || place?.subregion || place?.region || name;
  } catch {
    // Reverse geocoding isn't available everywhere (e.g. some web browsers); the forecast still works.
  }
  return { lat, lon, name };
}
