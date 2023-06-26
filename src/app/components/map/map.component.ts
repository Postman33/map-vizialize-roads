import {Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren} from '@angular/core';
import mapboxgl from "mapbox-gl";
import * as turf from '@turf/turf';
import {LineString} from '@turf/turf';
import {MapService} from "../../service/map.service";
import {DataService} from "../../service/data.service";
import {
  buildGraphFromJson,
  EdgeProperties,
  edges_clear_by_path,
  getPathCoordinates,
  longestPathByWeight,
  v2e,
  v2e_nin
} from "../../utils/graph-fn";
import {intensityColor} from '../../utils/color'
import Graph from "graphology";
import {getRoadLayerName, getSegmentLayerNames} from "../../utils/namespaces";
import {ScrollPanel} from "primeng/scrollpanel";

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {
  map: mapboxgl.Map = {} as mapboxgl.Map;
  popup!: mapboxgl.Popup | null;
  sidebarStatusIsActive = true;
  buttonAddIsDisabled: boolean = false; // Когда запрещать добавлять маршруты
  isMapLoaded = false
  activeRouteIndex: number | null = null; // Какой маршрут подсветить в каталоге карточек
  routes: {
    efficacy: number,
    overlay: number,
    hours: number,
    new_graph: Graph,
    path: any[],
    idLayer: string,
  }[] = []; // Список маршрутов
  graph: Graph = {} as Graph;
  routesColors = [
    '#ff0000',
    '#0f2ef6',
    '#00ff06',
    '#ad05ff',
    '#ffc60a',
    '#0aebff',
    '#ff0aba',
  ]
  store: Map<any, any> = new Map();
  @ViewChild('scrollPanel') scrollPanel!: ScrollPanel;
  @ViewChildren('routeList', {read: ElementRef}) routeList!: QueryList<ElementRef>;

  constructor(private mapService: MapService, public dataService: DataService) {
  }

  ngOnInit() {
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [37.6, 55.7],
      zoom: 9,
      maxZoom: 13,
      accessToken: "pk.eyJ1IjoicG9zdG1hbjMzIiwiYSI6ImNrdXNxbGh4OTBxanMyd28yanB3eDM4eDEifQ.WrqvvPXOzXuqQMpfkNutCg",
    });

    this.map.boxZoom.disable();
    this.map.scrollZoom.disable();
    this.map.dragRotate.disable();
    this.map.dragPan.disable();
    this.map.keyboard.disable();
    this.map.doubleClickZoom.disable();
    this.map.touchZoomRotate.disable();

    this.map.addControl(new mapboxgl.NavigationControl({}));


    this.mapService.setMap(this.map);
    this.map.on("load", () => {
      this.isMapLoaded = true;
      // Сделаем границы города Зеленограда, данные взяты с открытого источника
      this.dataService.getCityPolygon().subscribe(
        ({polygons, polygon, center}) => {
          let b = polygon.boundingbox
          let nwear = [b[2], b[0], b[3], b[1]] as [number, number, number, number]
          const duration = 2500;
          this.map.fitBounds(nwear, {
            zoom: 12,
            duration: duration,
          })
          setTimeout(()=>{
            this.map.boxZoom.enable();
            this.map.scrollZoom.enable();
            this.map.dragRotate.enable();
            this.map.dragPan.enable();
            this.map.keyboard.enable();
            this.map.doubleClickZoom.enable();
            this.map.touchZoomRotate.enable();
          }, duration)
          polygon.geojson.type = 'MultiLineString'
          this.map.addSource('city-polygon', {
            type: 'geojson',
            data: polygon.geojson,
          });


          this.dataService.getGraphs().subscribe((graphs) => {
            let graph = graphs[5];
            this.graph = buildGraphFromJson(graph);
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
        'line-color': 'rgb(255,0,0)',
        'line-width': 3,           // Толщина линии
        'line-opacity': 1,          // Прозрачность линии (1 - непрозрачно, 0 - прозрачно)
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      }
    });
  }

  private addPathToMap(path: any, graphVE: any, routeID = 0, color = '#1ae6fa'): void {
    let lineStringCoordinates: [number, number][] = getPathCoordinates(path, graphVE)

    const routeId = getRoadLayerName(routeID); // Уникальный идентификатор маршрута
    // Создаем источник с GeoJSON LineString
    let source = {
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
    } as mapboxgl.AnySourceData;
    this.map.addSource(routeId, source);

    // Добавляем слой линии маршрута, используя источник
    this.map.addLayer({
      'id': routeId,
      'type': 'line',
      'source': routeId,
      'layout': {
        'line-join': 'round',
        'line-cap': 'round',

      },
      'metadata': {'GC': lineStringCoordinates, source: source},
      'paint': {
        'line-color': color,
        'line-width': 8,
        'line-opacity-transition': {
          duration: 500,
        },
        'line-opacity': 1
      }
    });
  }

  // Делим LineString на множество отдельных LineString размером 2. Получаем возможность каждый участок превратить в слой, и также для детальной
  // Информации по осадкам на участках дорог.
  private addPathSegmentationToMap(pathCoordinates: [number, number][], path: any, graphVE: any): number[] {
    let pass: number[] = []
    for (let i = 0; i < pathCoordinates.length - 1; i++) {
      let segmentCoordinates = [pathCoordinates[i], pathCoordinates[i + 1]];
      pass.push(i);
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

      // Предыдущий и послеующая интенсивность осадков. Необходимо чтобы сделать плавный цветовой градиент, чтобы не было резких переходов
      //  Цветовой градиент      [ 0, int1, 0.1, int1, 0.2, int2 ]
      let int2 = intensityColor(snowfall_sum)
      let int1 = snowfall_sum_prev == 0 ? int2 : intensityColor(snowfall_sum_prev)

      // Удалим слои и источники, если они есть
      if (this.map.getLayer(getSegmentLayerNames(i)))
        this.map.removeLayer(getSegmentLayerNames(i))

      if (this.map.getSource(getSegmentLayerNames(i)))
        this.map.removeSource(getSegmentLayerNames(i))

      this.map.addSource(getSegmentLayerNames(i), {
        'type': 'geojson',
        'data': {
          'type': 'Feature',
          'properties': {},
          'geometry': {
            'type': 'LineString',
            'coordinates': segmentCoordinates
          }
        },
        lineMetrics: true
      });

      this.map.addLayer({
        'id': getSegmentLayerNames(i),
        "interactive": true,
        'type': 'line',
        'source': getSegmentLayerNames(i),
        'layout': {
          'line-join': 'round',
          'line-cap': 'round'
        },
        'metadata': {
          edgeId: edgeId
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
            duration: 300,  // Duration in milliseconds
          },
          'line-opacity': 0 // Initial opacity
        }
      })
      this.map.setPaintProperty(getSegmentLayerNames(i), "line-opacity", 1)
      this.map.moveLayer(getSegmentLayerNames(i)); // Перремещаем слой наверх.
    }
    return pass
  }

  // Добавить маршрут на карту, то есть добавить источники + слои
  addRoute() {
    if (this.buttonAddIsDisabled) return;
    const graph: Graph = this.routes[this.routes.length - 1] ? this.routes[this.routes.length - 1].new_graph : this.graph;
    let layerID = this.routes.length // Одновременно и адресация массива route, индекс, а также слой для
    let path = longestPathByWeight(graph, 22, 17)
    let coords = getPathCoordinates(path, graph)
    this.addPathToMap(path, graph, layerID, this.routesColors[this.routes.length])
    this.map.on("mouseenter", getRoadLayerName(layerID), (e) => {
      if (!this.popup) {
        this.rebuildPopup();
      }
      if (this.popup) this.popup.setLngLat(e.lngLat)
      this.scrollToIndex(layerID)
      this.viewIntensity_MOUSEENTER(coords, path, graph, layerID);
      this.activeRouteIndex = layerID;
    })

    this.map.on('mouseleave', getRoadLayerName(layerID), () => {
      if (this.popup) {
        this.popup.remove();
        this.popup = null;
      }
      this.viewIntensity_MOUSELEAVE(layerID);
      this.activeRouteIndex = null;
    })


    let ine = v2e(path, graph) // принадлежащие path ребра
    let not_ine = v2e_nin(path, graph)// не принадлежащие path ребра
    let ine_original = v2e(path, this.graph) // принадлежащие path ребра

    let sum_snow = 0
    let sum_snow_original = 0
    let sum_snow_not = 0
    let sum_km = 0

    for (let edge of ine) {
      sum_snow += edge.snowfall_sum;
      sum_km += edge.distance;
    }
    for (let edge of ine_original) {
      sum_snow_original += edge.snowfall_sum;
    }
    for (let edge of not_ine) {
      sum_snow_not += edge.snowfall_sum;
    }
    let efficacy = turf.round(100 * sum_snow / (sum_snow + sum_snow_not), 1);
    let overLapCoefficient = turf.round(100 - turf.round(100 * sum_snow / sum_snow_original, 1));
    this.routes.push({
      'efficacy': turf.round(efficacy / ((100 + overLapCoefficient) / 90)),
      "overlay": overLapCoefficient,
      'hours': 5,
      'path': path,
      "new_graph": edges_clear_by_path(path, graph),
      idLayer: layerID.toString()
    })
    if (efficacy >= 99) { // Когда эффективность конечного маршрута ~= 100， значит последующие маршруты не дадут никакой пользы
      this.buttonAddIsDisabled = true;
    }
  }

  // Часть подсветки интенсивности осадков. Удаление слоев и источников при выходе указателя мыши
  private viewIntensity_MOUSELEAVE(layerID: number | string) {
    this.map.getCanvas().style.cursor = '';

    if (this.map.getLayer(getRoadLayerName(layerID))) {
      let ids = this.store.get('ids') as number[]
      for (let id of ids) {
        if (this.map.getLayer(getSegmentLayerNames(id)))
          this.map.removeLayer(getSegmentLayerNames(id))

        if (this.map.getSource(getSegmentLayerNames(id)))
          this.map.removeSource(getSegmentLayerNames(id))
      }
    }
    for (let i = 0; i < this.routes.length; i++) {
      this.map.setPaintProperty(getRoadLayerName(i), "line-opacity", 1)
    }
  }

  // Часть подсветки интенсивности осадков. Создание слоев и источников при входе указателя мыши
  private viewIntensity_MOUSEENTER(coords: [number, number][], path: Array<number>, graph: Graph, layerID: number) {
    let ids = this.addPathSegmentationToMap(coords, path, graph)
    this.store.set('ids', ids)
    this.map.getCanvas().style.cursor = 'pointer';
    for (let i = 0; i < this.routes.length; i++) {
      this.map.setPaintProperty(getRoadLayerName(i), "line-opacity", 0.17)
    }
    this.map.setPaintProperty(getRoadLayerName(layerID), "line-opacity", 1)
  }

  // Кнопка 'Очистить все', удаляет слои и источники, очищает список маршрутов.
  removeAllRoutes() {
    this.routes.forEach((value, index, array) => {
      if (this.map.getLayer(getRoadLayerName(value.idLayer)))
        this.map.removeLayer(getRoadLayerName(value.idLayer));

      if (this.map.getSource(getRoadLayerName(value.idLayer)))
        this.map.removeSource(getRoadLayerName(value.idLayer));

      this.routes = [];
      this.buttonAddIsDisabled = false;
    })
  }

  // Событие наводки на карточку маршрута
  selectLayerByCard_ME($event: MouseEvent, route: any, layerID: any) {
    this.activeRouteIndex = layerID
    let path = route.path;
    let coords = getPathCoordinates(path, this.graph)
    this.viewIntensity_MOUSEENTER(coords, path, this.graph, layerID);


    let layer = this.map.getLayer((getRoadLayerName(layerID))) as mapboxgl.LineLayer
    let linestring: LineString = layer.metadata.source.data.geometry
    let points = turf.lineString(linestring.coordinates)
    let length = turf.length(points, {units: 'kilometers'});
    let midPoint = turf.along(linestring, length, {units: 'kilometers'});
    this.rebuildPopup()
    this.popup?.setLngLat(midPoint.geometry.coordinates as mapboxgl.LngLatLike)
  }

  // Событие выхода указатели мыши из карточки маршрута
  deselectLayerByCard_ML($event: MouseEvent, layerID: any) {
    this.activeRouteIndex = null
    this.viewIntensity_MOUSELEAVE(layerID)
    this.popup?.remove();
    this.popup = null;
  }


  scrollToIndex(index: number) {
    // Сначала дождитесь, пока Angular соберет список элементов DOM.
    if (this.routeList.toArray()[index]) {
      // Получите позицию элемента, до которого вы хотите прокрутить.
      const position = this.routeList.toArray()[index].nativeElement.offsetTop;
      // Используйте эту позицию, чтобы прокрутить p-scrollPanel до этого элемента.
      this.scrollPanel.scrollTop(position);
    }
  }

  rebuildPopup() {
    const popupContent = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = 'Интенсивность снегопада';
    title.style.textAlign = 'center';
    title.style.paddingBottom = '5px';
    title.style.fontFamily = 'Arial, serif';
    title.style.fontSize = '14px';

    popupContent.appendChild(title);

    // Низкая (0-5) (#008000)
    const lowIntensity = document.createElement('div');
    const lowIntensityColor = document.createElement('span');
    lowIntensityColor.style.backgroundColor = '#008000';
    lowIntensityColor.style.borderRadius = '50%';
    lowIntensityColor.style.width = '10px';
    lowIntensityColor.style.height = '10px';
    lowIntensityColor.style.marginRight = '5px';
    lowIntensityColor.style.opacity = '0.7';
    lowIntensityColor.style.display = 'inline-block';
    lowIntensity.appendChild(lowIntensityColor);
    lowIntensity.innerHTML += 'Низкая (0-5mm)';
    lowIntensity.style.fontFamily = 'Arial, serif';
    lowIntensity.style.fontSize = '14px';
    popupContent.appendChild(lowIntensity);

    // Средняя (5-10) (#FFA500)
    const mediumIntensity = document.createElement('div');
    const mediumIntensityColor = document.createElement('span');
    mediumIntensityColor.style.backgroundColor = '#FFA500';
    mediumIntensityColor.style.borderRadius = '50%';
    mediumIntensityColor.style.width = '10px';
    mediumIntensityColor.style.height = '10px';
    mediumIntensityColor.style.marginRight = '5px';
    mediumIntensityColor.style.opacity = '0.7';
    mediumIntensityColor.style.display = 'inline-block';
    mediumIntensity.appendChild(mediumIntensityColor);
    mediumIntensity.innerHTML += 'Средняя (5-10mm)';
    mediumIntensity.style.fontFamily = 'Arial, serif';
    mediumIntensity.style.fontSize = '14px';
    popupContent.appendChild(mediumIntensity);

    // Высокая (>10) (#FF0000)
    const highIntensity = document.createElement('div');
    const highIntensityColor = document.createElement('span');
    highIntensityColor.style.backgroundColor = '#FF0000';
    highIntensityColor.style.borderRadius = '50%';
    highIntensityColor.style.width = '10px';
    highIntensityColor.style.height = '10px';
    highIntensityColor.style.marginRight = '5px';
    highIntensityColor.style.opacity = '0.7';
    highIntensityColor.style.display = 'inline-block';
    highIntensity.appendChild(highIntensityColor);
    highIntensity.innerHTML += 'Высокая (>10mm)';
    highIntensity.style.fontFamily = 'Arial, serif';
    highIntensity.style.fontSize = '14px';
    popupContent.appendChild(highIntensity);

    // Применение стилей к контейнеру
    popupContent.classList.add('legend');
    popupContent.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';

    this.popup = new mapboxgl.Popup({})

    this.popup.addTo(this.map).setDOMContent(popupContent)

  }

}
