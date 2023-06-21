// Выбор цвета шкалы интенсивности
export function intensityColor(snowfall_sum: number = 0): string {
  return snowfall_sum > 3 ? '#f00' :
    snowfall_sum > 1 ? '#ff0' :
      '#79d21f';
}
