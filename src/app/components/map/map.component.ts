import {Component} from '@angular/core';
import mapboxgl from "mapbox-gl";
import {MapService} from "../../service/map.service";
import {DataService} from "../../service/data.service";
import {
  buildGraphFromJson,
  EdgeProperties, edges_clear_by_path,
  getPathCoordinates,
  longestPathByWeight,
  v2e,
  v2e_nin
} from "../../utils/graph-fn";
import {intensityColor} from '../../utils/color'
import {round, union} from "@turf/turf";
import Graph from "graphology";
import {unionSet} from "../../utils/math";

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent {
  map: mapboxgl.Map = {} as mapboxgl.Map;
  displaySidebar = true;
  routes: {
    'efficacy': number,
    'overlay': number,
    'hours': number,
    "new_graph": Graph,
    idLayer: string,
  }[] = [];
  mainGraph: Graph = {} as Graph;
  colors = [
    '#ff0000',
    '#0f2ef6',
    '#00ff06',
    '#ad05ff',
    '#ffc60a',
    '#0aebff',
    '#ff0aba',
  ]
  disabledAdd: boolean = false;

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
    this.map.addControl(new mapboxgl.NavigationControl());

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
            this.mainGraph = buildGraphFromJson(graph);

          })
          this.addLineLayerOfRegion();


        })


    })
  }


  private addLineLayerOfRegion() {
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
  }
  private addPathToMap(lineStringCoordinates: [number, number][], path: any, graphVE: any, routeID = 0, color='#1ae6fa'): void {
    const routeId = `route-${routeID}`; // Замените на уникальный идентификатор маршрута, если добавляете несколько маршрутов

    // Создаем источник с GeoJSON LineString
    this.map.addSource(routeId, {
      'type': 'geojson',
      'data': {
        'type': 'Feature',
        'properties': {},
        'geometry': {
          'type': 'LineString',
          'coordinates': lineStringCoordinates
        }
      },
      lineMetrics: true
    });

    // Добавляем слой линии, используя источник
    this.map.addLayer({
      'id': routeId,
      'type': 'line',
      'source': routeId,
      'layout': {
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': color,  // Пример цвета, замените на ваш цвет
        // 'line-gradient': [
        //   'interpolate',
        //   ['linear'],
        //   ['line-progress'],
        //   0,
        //   '#00ff00',    // Замените на начальный цвет градиента
        //   1,
        //   '#ff0000'     // Замените на конечный цвет градиента
        // ],
        'line-width': 8,
        'line-opacity-transition': {
          duration: 500,  // Продолжительность в миллисекундах
        },
        'line-opacity': 1 // Начальная непрозрачность
      }
    });
  }
  private addPathSegmentationToMap(pathCoordinates: [number, number][], path: any, graphVE: any): void {
    for (let i = 0; i < pathCoordinates.length - 1; i++) {
      let segmentCoordinates = [pathCoordinates[i], pathCoordinates[i + 1]];

      const edgeKeys = graphVE.edges(path[i]);
      let edgeId: string = "";
      let edgeIdPV: string = "";
      let snowfall_sum_prev = 0;
      let snowfall_sum = 0;

      if (i > 1) {
        const edgeKeysForPrevEdge = graphVE.edges(path[i - 1]);
        for (const edgeKey of edgeKeysForPrevEdge) {
          const edgeData = graphVE.getEdgeAttributes(edgeKey) as EdgeProperties;
          if ((edgeData.source === path[i - 1] && edgeData.target === path[i] || edgeData.source === path[i] && edgeData.target === path[i - 1])) {
            edgeIdPV = edgeKey;
            snowfall_sum_prev = edgeData.snowfall_sum;
          }
        }
      }


      for (const edgeKey of edgeKeys) {
        const edgeData = graphVE.getEdgeAttributes(edgeKey) as EdgeProperties;
        if (edgeData.source === path[i] && edgeData.target === path[i + 1] || edgeData.source === path[i + 1] && edgeData.target === path[i]) {
          edgeId = edgeKey;
          snowfall_sum = edgeData.snowfall_sum;
          break;
        }
      }

      let int2 = intensityColor(snowfall_sum)
      let int1 = snowfall_sum_prev == 0 ? int2 : intensityColor(snowfall_sum_prev)

      this.map.addSource(`routeSegment${i}`, {
        'type': 'geojson',
        'data': {
          'type': 'Feature',
          'properties': {
          },
          'geometry': {
            'type': 'LineString',
            'coordinates': segmentCoordinates
          }
        },
        lineMetrics: true
      });

      this.map.addLayer({
        'id': `routeSegment${i}`,
        "interactive":true,
        'type': 'line',
        'source': `routeSegment${i}`,
        'layout': {
          'line-join': 'round',
          'line-cap': 'round'
        },
        'metadata': {
          edgeId:edgeId
        },
        'paint': {
          'line-color': int2,
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            int1,    // Начальный цвет градиента
            0.1,
            int1,   // Цвет по середине градиента
            0.2,
            int2      // Конечный цвет градиента
          ],
          'line-width': 8,
          'line-opacity-transition': {
            duration: 500,  // Duration in milliseconds
          },
          'line-opacity': 0 // Initial opacity
        }
      });

      this.map.on('mouseenter', `routeSegment${i}`, (e) => {
        // Change the cursor style as a UI indicator.
        this.map.getCanvas().style.cursor = 'pointer';

        //const edgeId = `routeSegment${i}`;
        const snowfall_sum = graphVE.getEdgeAttribute(edgeId, 'snowfall_sum');
        const distance = graphVE.getEdgeAttribute(edgeId, 'distance');

        this.map.setPaintProperty(`routeSegment${i}`, 'line-color', '#00ffea');

        this.map.addLayer({
          id: `infoLayer${i}`,
          type: 'symbol',
          source: `routeSegment${i}`,
          layout: {
            'text-field': `снега: ${round(snowfall_sum*100)} mm^3\n дорога: ${round(distance*1000)} м`,
            'text-size': 12,

          },
          paint: {
            'text-color': '#000',
            'text-halo-color': '#fff',
            'text-halo-width': 4
          }
        });
      });


      this.map.on('mouseleave', `routeSegment${i}`, () => {
        this.map.getCanvas().style.cursor = '';
        if (this.map.getLayer(`infoLayer${i}`)) {
          this.map.removeLayer(`infoLayer${i}`);
        }
        //this.map.setPaintProperty(`routeSegment${i}`, 'line-color', int2);

      });


      setTimeout(() => {
        this.map.setPaintProperty(`routeSegment${i}`, 'line-opacity', 1);
      }, 5000 + 250 * i);

    }


  }


  addRoute() {
    if (this.disabledAdd) return;

    const graph: Graph = this.routes[this.routes.length - 1] ? this.routes[this.routes.length - 1].new_graph : this.mainGraph;
    let layerID = this.routes.length
    let path = longestPathByWeight(graph, 22, 17)
    let coords = getPathCoordinates(path, graph)
    this.addPathToMap(coords, path, graph,layerID,this.colors[this.routes.length])

    console.log('Принадлежит')
    console.log(v2e(path,graph))
    let ine = v2e(path,graph) // принадлежащие path ребра
    let not_ine = v2e_nin(path,graph)// не принадлежащие path ребра
    let all = unionSet(ine,not_ine);
    let ine_original = v2e(path,this.mainGraph) // принадлежащие path ребра

    let sum_snow = 0
    let sum_snow_original = 0
    let sum_snow_not = 0
    let sum_km = 0

    for( let edge of ine){
      sum_snow+=edge.snowfall_sum;
      sum_km+=edge.distance;
    }
    for( let edge of ine_original){
      sum_snow_original+=edge.snowfall_sum;
    }
    for( let edge of not_ine){
      sum_snow_not+=edge.snowfall_sum;
    }
    let efficacy = round(100*sum_snow/(sum_snow+sum_snow_not),1);
    let overLapCoefficient =round(100-round(100* sum_snow/sum_snow_original,1));
    this.routes.push({
      'efficacy': efficacy,
      "overlay": overLapCoefficient,
      'hours': 5,
      "new_graph": edges_clear_by_path(path, graph),
      idLayer: layerID.toString()
    })
    if (efficacy >= 99) {
      this.disabledAdd = true;
    }
    console.log('Не принадлежит')
    console.log(v2e_nin(path,graph))
  }

  removeAllRoutes() {
    this.routes.forEach( (value, index, array)=> {
      this.map.removeLayer(`route-${value.idLayer}`);
      this.map.removeSource(`route-${value.idLayer}`);
      this.routes = [];
      this.disabledAdd = false;
    })
  }
}
