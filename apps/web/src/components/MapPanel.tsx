import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { SerializedEvent } from '../types';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function MapPanel({ events }: { events: SerializedEvent[] }) {
  const located = events.filter((e) => e.location);
  if (located.length === 0) return null;
  const center: [number, number] = [located[0].location!.lat, located[0].location!.lng];

  return (
    <section className="panel">
      <h2 className="section-title">Places mentioned ({located.length})</h2>
      <MapContainer center={center} zoom={2} style={{ height: 320, borderRadius: 10 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((e) => (
          <Marker key={e.id} position={[e.location!.lat, e.location!.lng]} icon={icon}>
            <Popup>
              <strong>{e.title}</strong>
              <br />
              {e.location!.name}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}
