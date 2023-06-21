export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // радиус Земли в километрах
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // расстояние в километрах
}
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}
export function unionSet<T>(set1:Set<T>, set2:Set<T>): Set<T> {
  return new Set([...set1, ...set2]);
}
