'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslations } from 'next-intl';
import { MapSkeleton } from '@/components/ui/skeletons';

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  /** When false, map is display-only (no click-to-pick). Default true. */
  interactive?: boolean;
};

const PRIZREN: [number, number] = [42.2139, 20.7397];

// Fix default marker icons under Next/webpack
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function LocationPickerMap({ lat, lng, onPick, interactive = true }: Props) {
  const t = useTranslations('Common');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: lat != null && lng != null ? [lat, lng] : PRIZREN,
      zoom: 14,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
    });

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    tiles.on('load', () => setReady(true));

    if (interactive) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;
    const timeout = window.setTimeout(() => setReady(true), 4000);

    return () => {
      window.clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
    // Mount once; lat/lng updates handled below. interactive is fixed per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
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

  useEffect(() => {
    if (ready) mapRef.current?.invalidateSize();
  }, [ready]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-md border border-stone-300 sm:h-72">
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 z-[500]">
          <MapSkeleton className="h-full w-full" />
          <span className="sr-only">{t('mapLoading')}</span>
        </div>
      ) : null}
      <div
        ref={containerRef}
        role={interactive ? 'application' : 'img'}
        aria-label={interactive ? t('locationMapPick') : t('locationMapView')}
        className="h-full w-full"
      />
    </div>
  );
}
