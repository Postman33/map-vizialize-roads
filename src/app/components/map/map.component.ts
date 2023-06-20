import {Component} from '@angular/core';
import mapboxgl, {LngLatBounds} from "mapbox-gl";
import {MapService} from "../../service/map.service";
import {DataService} from "../../service/data.service";
import {map, Observable, of} from "rxjs";
import {buildGraphFromJson, EdgeProperties, getPathCoordinates, longestPathByWeight} from "../../utils/graph-fn";

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent {
  map: mapboxgl.Map = {} as mapboxgl.Map;

  constructor(private mapService: MapService, public dataService: DataService) {
  }

  ngOnInit() {
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.5, 40],
      zoom: 9,
      maxZoom: 13,
      accessToken: "pk.eyJ1IjoicG9zdG1hbjMzIiwiYSI6ImNrdXNxbGh4OTBxanMyd28yanB3eDM4eDEifQ.WrqvvPXOzXuqQMpfkNutCg"
    });
    this.mapService.setMap(this.map);
    this.map.on("load", () => {
      this.dataService.getCityPolygon().subscribe(
        ({polygons, polygon, center}) => {
          let b = polygon.boundingbox
          let nwear = [b[2], b[0], b[3], b[1]] as [number, number, number, number]
          this.map.fitBounds(nwear, {
            zoom: 12
          })
          polygon.geojson.type = 'MultiLineString'
          this.map.addSource('city-polygon', {
            type: 'geojson',
            data: polygon.geojson,
            lineMetrics: true
          });

          // @ts-ignore

          this.dataService.getGraphs().subscribe((graphs) => {
            let graph = graphs[5];
            console.log(graph)
            let graphVE = buildGraphFromJson(graph)

            graphVE.forEachEdge((edge, attributes, source, target) => {
              console.log(`Edge: ${edge}, Source: ${source}, Target: ${target}`);
            });
            let path = longestPathByWeight(graphVE, 22, 17)
            console.log(path)
            let coords = getPathCoordinates(path, graphVE)
            this.addPathToMap(coords, path, graphVE)
            console.log(coords)
            console.log(path)
            console.log(graph)


          })
          this.map.addLayer({
            id: 'city-polygon',
            type: 'line',
            source: 'city-polygon',
            paint: {
              'line-color': 'red',

              'line-gradient': [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0,
                'blue',    // Начальный цвет градиента
                0.5,
                'green',   // Цвет по середине градиента
                1,
                'red'      // Конечный цвет градиента
              ],      // Цвет линии
              'line-width': 6,           // Толщина линии
              'line-opacity': 1          // Прозрачность линии (1 - непрозрачно, 0 - прозрачно)
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            }
          });


        })


    })
  }


  private addPathToMap(pathCoordinates: [number, number][], path: any, graphVE: any): void {
    for (let i = 0; i < pathCoordinates.length - 1; i++) {
      let segmentCoordinates = [pathCoordinates[i], pathCoordinates[i + 1]];

      const edgeKeys = graphVE.edges(path[i]);
      let edgeId = "";
      let snowfall_sum = 0;
      for (const edgeKey of edgeKeys) {
        const edgeData = graphVE.getEdgeAttributes(edgeKey) as EdgeProperties;
        if (edgeData.source === path[i] && edgeData.target === path[i + 1] || edgeData.source === path[i + 1] && edgeData.target === path[i]) {
          edgeId = edgeKey;
          snowfall_sum = edgeData.snowfall_sum;
          break;
        }
      }

      let color = '#79d21f';
      if (snowfall_sum > 3) {
        color = '#f00';
      } else if (snowfall_sum > 1) {
        color = '#ff0';
      }

      this.map.addSource(`routeSegment${i}`, {
        'type': 'geojson',
        'data': {
          'type': 'Feature',
          'properties': {},
          'geometry': {
            'type': 'LineString',
            'coordinates': segmentCoordinates
          }
        }
      });

      this.map.addLayer({
        'id': `routeSegment${i}`,
        'type': 'line',
        'source': `routeSegment${i}`,
        'layout': {
          'line-join': 'round',
          'line-cap': 'round'
        },
        'paint': {
          'line-color': color,
          'line-width': 8,
          'line-opacity-transition': {
            duration: 500,  // Duration in milliseconds
          },
          'line-opacity': 0 // Initial opacity
        }
      });
      setTimeout(() => {
        this.map.setPaintProperty(`routeSegment${i}`, 'line-opacity', 1);
      }, 5000 + 250 * i);

    }


  }


}
