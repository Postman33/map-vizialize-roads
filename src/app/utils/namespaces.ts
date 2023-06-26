// Наименования слоев СЕГМЕНТИРОВАННЫХ слоев и источников для ДОРОГ
export function getSegmentLayerNames(id: string | number) {
  return `routeSegment${id}`;
}

// Наименования слоев НЕсегментированных слоев и источников для ДОРОГ
export function getRoadLayerName(id: string | number): string {
  return `route-${id}`;
}
