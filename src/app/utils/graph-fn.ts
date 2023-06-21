import Graph, {MultiGraph, MultiUndirectedGraph, UndirectedGraph} from "graphology";
import EdgeKey from "graphology-types";
import {haversineDistance} from "./math";

interface NodeProperties {
  coordinates: [number, number];
}

export interface EdgeProperties {
  source: number;
  target: number;
  snowfall_sum: number;
  distance: number;
}

interface GraphData {
  nodes: Array<{ id: number; geometry: NodeProperties }>;
  edges: Array<{ id: number; properties: EdgeProperties; geometry: { coordinates: Array<[number, number]> } }>;
}

export function buildGraphFromJson(graphData: any): Graph {
  const graph = new UndirectedGraph({});

  // add nodes to the graph
  for (const node of graphData.nodes) {
    graph.addNode(node.id, node.geometry);
  }


  // add edges to the graph
  for (const edge of graphData.edges) {
    const startCoords = edge.geometry.coordinates
    const edgeDistance = haversineDistance(startCoords[0][0], startCoords[0][1], startCoords[1][0], startCoords[1][1]);
    edge.properties.distance = edgeDistance

    edge.properties.snowfall_sum = edge.properties.snowfall_next * edgeDistance
    const edgeKey = `${edge.id}`;
    graph.mergeEdgeWithKey(edgeKey, edge.properties.source, edge.properties.target, edge.properties);


  }

  return graph;
}

export function longestPathByWeight(
  graph: Graph,
  start: number,
  end: number,
  path: Array<number> = [],
  totalWeight: number = 0,
  totalDistance: number = 0
): Array<number> {
  path = [...path, start];
  if (start === end && totalDistance <= 65) {
    return path;
  }

  let longest: Array<number> = [];
  graph.edges(start).forEach((edgeKey: string) => {
    try {
      const edgeData = graph.getEdgeAttributes(edgeKey) as EdgeProperties;
      const neighbor = edgeData.target === start ? edgeData.source : edgeData.target;
      if (!path.includes(neighbor)) {

        const newWeight = totalWeight + edgeData.snowfall_sum;

        const startCoords = graph.getNodeAttribute(start, "coordinates") as [number, number];
        const endCoords = graph.getNodeAttribute(neighbor, "coordinates") as [number, number];
        const edgeDistance = haversineDistance(startCoords[1], startCoords[0], endCoords[1], endCoords[0]);
        const newDistance: number = totalDistance + edgeDistance;
        if (newDistance <= 65) {
          const newPath = longestPathByWeight(
            graph,
            neighbor,
            end,
            path,
            newWeight,
            newDistance
          );

          if (newPath && (!longest.length || calculateWeight(newPath, graph) > calculateWeight(longest, graph))) {
            longest = newPath;
          }
        }
      }

    } catch (e) {
      //console.log('err')
    }
  });
  return longest;
}

export function calculateWeight(path: Array<number>, graph: Graph): number {
  let totalWeight = 0;
  for (let i = 0; i < path.length - 1; i++) {
    // Find the edge that connects path[i] and path[i + 1]
    const edgeKeys = graph.edges(path[i]);
    for (const edgeKey of edgeKeys) {
      const edgeData = graph.getEdgeAttributes(edgeKey) as EdgeProperties;
      if (edgeData.source === path[i] && edgeData.target === path[i + 1] || edgeData.source === path[i + 1] && edgeData.target === path[i]) {
        totalWeight += edgeData.snowfall_sum;
        break;
      }
    }
  }
  return totalWeight;
}

export function getPathCoordinates(path: Array<number>, graphVE: UndirectedGraph): [number, number][] {
  let pathCoordinates: [number, number][] = []
  path.forEach(nodeId => {
    let nodeCoordinates = graphVE.getNodeAttribute(nodeId, "coordinates") as [number, number];
    pathCoordinates.push(nodeCoordinates);
  });
  return pathCoordinates
}
// Ребра принадлежащие path
export function v2e(path: any, graph: Graph): Set<EdgeProperties>{

  let edges: Set<EdgeProperties> = new Set<EdgeProperties>();
  for (let i = 0; i < path.length - 1; i++) {
    graph.forEachEdge((edge, attributes, source, target) => {
      if (((source == path[i]) && (target == path[i+1])) || ((target == path[i]) && (source == path[i+1]))){
        edges.add(graph.getEdgeAttributes(edge) as EdgeProperties);
      }
    });

  }
return edges
}

// Ребра не принадлежащие path
export function v2e_nin(path: any, graph: Graph): Set<EdgeProperties>{
  let eges_in = v2e(path,graph);

  let edges: Set<EdgeProperties> = new Set<EdgeProperties>();
  for (let i = 0; i < path.length - 1; i++) {
    graph.forEachEdge((edge, attributes, source, target) => {
      if (!eges_in.has(graph.getEdgeAttributes(edge) as EdgeProperties)){
        edges.add(graph.getEdgeAttributes(edge) as EdgeProperties);
      }
    });

  }
  return edges
}


export function edges_clear_by_path(path: number[], graph: Graph): Graph {
  const newGraph = graph.copy();  // Создаем копию исходного графа

  for (let i = 0; i < path.length - 1; i++) {
    newGraph.forEachEdge((edge, attributes, source, target) => {
      if ((+source == path[i] && +target == path[i+1]) || (+target == path[i] && +source == path[i+1])) {
        // Нашли ребро из path, обнуляем атрибут snowfall_sum
        newGraph.setEdgeAttribute(edge, 'snowfall_sum', 0);
      }
    });
  }

  return newGraph;  // Возвращаем новый граф с обнуленными весами ребер из path
}
