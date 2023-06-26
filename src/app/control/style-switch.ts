import {IControl, Map as MapboxMap} from 'mapbox-gl';

export interface StyleOption {
  name: string;
  url: string;
}

export class StyleSwitcherControl implements IControl {
  private styles: StyleOption[];
  private container: HTMLDivElement;
  private select: HTMLSelectElement;
  private map?: MapboxMap;

  constructor(styles: StyleOption[]) {
    this.styles = styles;
    this.container = document.createElement('div');
    this.container.className = 'mapboxgl-ctrl';
    this.select = document.createElement('select');
    this.container.appendChild(this.select);
  }

  onAdd(map: MapboxMap): HTMLElement {
    this.map = map;
    for (const style of this.styles) {
      const option = document.createElement('option');
      option.text = style.name;
      option.value = style.url;
      this.select.appendChild(option);
    }
    this.select.addEventListener('change', (event) => {
      if (this.map && event.target instanceof HTMLSelectElement) {
        const layers = map.getStyle().layers;

        console.log(layers)
        this.map.setStyle(event.target.value);

        this.map.on('style.load', () => {
          // восстановление ваших слоев
          // for (const layer of myLayers) {
          //   map.addLayer(layer);
          // }
        });

      }
    });
    return this.container;
  }

  onRemove(): void {
    this.container.parentNode?.removeChild(this.container);
    this.map = undefined;
  }

  getDefaultPosition(): string {
    return 'top-right';
  }
}
