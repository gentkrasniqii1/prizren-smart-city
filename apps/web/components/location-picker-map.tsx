'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
};

const PRIZREN: [number, number] = [42.2139, 20.7397];

// Fix default marker icons under Next/webpack
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function LocationPickerMap({ lat, lng, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: PRIZREN,
      zoom: 14,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onPickRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) return;

    const position: [number, number] = [lat, lng];
    if (!markerRef.current) {
      markerRef.current = L.marker(position).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
    }
    map.panTo(position);
  }, [lat, lng]);

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-md border border-stone-300" />;
}
