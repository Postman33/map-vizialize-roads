import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {map, Observable} from "rxjs";
import { point, featureCollection, center } from '@turf/turf';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private http: HttpClient) {
  }

  // Получить граф карты дорог Зеленограда. Собирался вручную
  getGraphs(): Observable<any> {
    return this.http.get('assets/graphs_3.json');
  }

  // Получить границы города Зеленограда, формат ответа - GeoJSON， см. спецификацию.
  getCityPolygon(): Observable<any> {
    return this.http.get<any>('https://nominatim.openstreetmap.org/search?q=%D0%B7%D0%B5%D0%BB%D0%B5%D0%BD%D0%BE%D0%B3%D1%80%D0%B0%D0%B4&format=json&polygon_geojson=1')
  .pipe(
      map((response: any) => {
        const coordinates = response[0]?.geojson?.coordinates;
        if (!coordinates) {
          throw new Error('Invalid response format');
        }

        const points = coordinates[0].map((coords: number[]) => point(coords));
        const centerPoint = center(featureCollection(points));

        return {
          polygons: response,
          polygon: response[0],
          center: centerPoint.geometry.coordinates
        };
      }));

  }

}
