import L from 'leaflet';
import { placeData, PLACE_ATTRIBUTION, selectPlaceLabels } from '../services/mapLabels';

export function addPlaceLabels(map: L.Map): { available: boolean; remove: () => void } {
  const group = L.layerGroup().addTo(map);
  const refresh = () => {
    group.clearLayers();
    if (!placeData.success) return;
    const center = map.getCenter().lng;
    const wrapLongitude = (lon: number) => lon + 360 * Math.round((center - lon) / 360);
    const container = map.getContainer();
    const switcher = container.parentElement?.querySelector<HTMLElement>('[data-map-layer-switcher]');
    const obstacles = [];
    if (switcher) {
      const origin = container.getBoundingClientRect();
      const box = switcher.getBoundingClientRect();
      obstacles.push({ left: box.left - origin.left - 6, right: box.right - origin.left + 6,
        top: box.top - origin.top - 6, bottom: box.bottom - origin.top + 6 });
    }
    const labels = selectPlaceLabels(placeData.data.places, map.getSize(), (place) =>
      map.latLngToContainerPoint([place.lat, wrapLongitude(place.lon)]), obstacles);
    for (const { place, width } of labels) {
      const label = document.createElement('span');
      label.className = 'field-place-label';
      label.textContent = place.name;
      label.title = place.name;
      label.setAttribute('aria-hidden', 'true');
      L.marker([place.lat, wrapLongitude(place.lon)], {
        pane: 'satellite-labels', interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'field-place-icon', html: label, iconSize: [width, 28], iconAnchor: [width / 2, 14] })
      }).addTo(group);
    }
  };
  map.attributionControl?.addAttribution(PLACE_ATTRIBUTION);
  map.on('moveend resize', refresh);
  refresh();
  return {
    available: placeData.success,
    remove: () => {
      map.off('moveend resize', refresh);
      group.remove();
      map.attributionControl?.removeAttribution(PLACE_ATTRIBUTION);
    }
  };
}
