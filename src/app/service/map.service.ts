import {Injectable} from '@angular/core';
import mapboxgl from 'mapbox-gl';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: mapboxgl.Map = {} as mapboxgl.Map;

  constructor() {
    // Инициализация карты и другие настройки
  }

  setMap(map: mapboxgl.Map){
    this.map = map
  }

  getMap(): mapboxgl.Map {
    return this.map;
  }

}
