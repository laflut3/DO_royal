export interface MapDefinition {
  id: string
  name: string
  description: string
  mapKey: string
  path: string
  tileSets: Array<string>
}

export const DEFAULT_MAP_ID = "fest_room";

export const MAP_CATALOG: Array<MapDefinition> = [
  {
    id: DEFAULT_MAP_ID,
    name: "Fest Room",
    description: "Grande salle interieure avec salons et couloirs.",
    mapKey: "map_fest_room",
    path: "assets/maps/fest_room/fest_room_map.json",
    tileSets: ["build_atlas", "indoor1", "indoor2", "indoor3"]
  },
  {
    id: "greenhouse",
    name: "Serre Centrale",
    description: "Jardin interieur, bureaux vitres et chemins circulaires.",
    mapKey: "map_greenhouse",
    path: "assets/maps/generated/greenhouse_map.json",
    tileSets: ["build_atlas", "indoor1", "indoor2", "indoor3"]
  },
  {
    id: "warehouse",
    name: "Depot Industriel",
    description: "Entrepot serre avec barricades, reserves et longues lignes.",
    mapKey: "map_warehouse",
    path: "assets/maps/generated/warehouse_map.json",
    tileSets: ["build_atlas", "indoor1", "indoor2", "indoor3"]
  },
  {
    id: "apartments",
    name: "Residences Nord",
    description: "Appartements relies par patios et salles communes.",
    mapKey: "map_apartments",
    path: "assets/maps/generated/apartments_map.json",
    tileSets: ["build_atlas", "indoor1", "indoor2", "indoor3"]
  }
]

export function getMapDefinition(mapId: string | undefined): MapDefinition {
  return MAP_CATALOG.find((mapDefinition) => mapDefinition.id === mapId) || MAP_CATALOG[0];
}
