'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslations } from 'next-intl';
import type { ReportDto } from '@prizren/shared-types';
import { MapSkeleton } from '@/components/ui/skeletons';
import { cn } from '@/lib/utils';

const PRIZREN: [number, number] = [20.7397, 42.2139];

const CATEGORY_COLORS: Record<string, string> = {
  'Grope / dëmtim rruge': '#b91c1c',
  'Ndriçim publik i prishur': '#d97706',
  'Grumbullim mbeturinash / konteiner': '#15803d',
  'Kanalizim / përmbytje urbane': '#0e7490',
  'Ujë i pijshëm (ndërprerje / cilësi)': '#1d4ed8',
  'Parke, pemë, hapësirë e gjelbër': '#7c3aed',
  'Ndërtim pa leje / shkelje urbanistike': '#c2410c',
  'Pengesë në trotuar / qasje': '#a16207',
  'Hedhje e paligjshme / ndotje': '#166534',
  'Zhurmë / shqetësim në lagje': '#6d28d9',
  'Rrezik zjarri / emergjencë': '#991b1b',
  'Sinjalistikë / rrezik në trafik': '#b45309',
  'Monument / trashëgimi e dëmtuar': '#9f1239',
  'Infrastrukturë shkollore e rrezikshme': '#1e40af',
  'Infrastrukturë e kujdesit shëndetësor komunal': '#0f766e',
  'Tjetër / e paklasifikuar': '#57534e',
  'Kafshë endacake': '#3f6212',
  'Okupim i paligjshëm i pronës komunale': '#44403c',
};

function colorForCategory(name: string | null | undefined): string {
  if (!name) return '#57534e';
  return CATEGORY_COLORS[name] ?? '#57534e';
}

type Props = {
  reports: ReportDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

export function ReportsMap({ reports, selectedId, onSelect, className }: Props) {
  const t = useTranslations('Reports');
  const tCommon = useTranslations('Common');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!containerRef.current || !token || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: PRIZREN,
      zoom: 13,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('reports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 16,
        clusterRadius: 50,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'reports',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#335f9b',
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 30],
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'reports',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#faf8f5',
        },
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'reports',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 11, 8],
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 2],
          'circle-stroke-color': ['case', ['==', ['get', 'selected'], 1], '#335f9b', '#ffffff'],
        },
      });

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id as number | undefined;
        const source = map.getSource('reports') as mapboxgl.GeoJSONSource;
        if (clusterId === undefined) return;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom === null || zoom === undefined) return;
          const geometry = features[0].geometry;
          if (geometry.type !== 'Point') return;
          map.easeTo({
            center: geometry.coordinates as [number, number],
            zoom,
          });
        });
      });

      map.on('click', 'unclustered-point', (e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
      });

      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
      });
      setReady(true);
    });

    map.once('error', () => setReady(true));
    const timeout = window.setTimeout(() => setReady(true), 8000);

    return () => {
      window.clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (ready) mapRef.current?.resize();
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      const source = map.getSource('reports') as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;

      source.setData({
        type: 'FeatureCollection',
        features: reports.map((r) => ({
          type: 'Feature',
          properties: {
            id: r.id,
            color: colorForCategory(r.categoryName),
            status: r.status,
            categoryName: r.categoryName,
            description: r.description.slice(0, 80),
            selected: r.id === selectedId ? 1 : 0,
          },
          geometry: {
            type: 'Point',
            coordinates: [r.lng, r.lat],
          },
        })),
      });
    };

    if (map.isStyleLoaded()) {
      sync();
    } else {
      map.once('load', sync);
    }
  }, [reports, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const report = reports.find((r) => r.id === selectedId);
    if (!report) return;
    map.easeTo({ center: [report.lng, report.lat], zoom: Math.max(map.getZoom(), 15) });
  }, [selectedId, reports]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return (
      <div
        className={`flex h-full min-h-[320px] items-center justify-center bg-stone-100 px-4 text-center text-sm text-stone-600 ${className ?? ''}`}
      >
        Mungon NEXT_PUBLIC_MAPBOX_TOKEN ne .env.local
      </div>
    );
  }

  return (
    <div className={cn('relative h-full min-h-[320px] w-full', className)}>
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <MapSkeleton className="h-full min-h-[320px] w-full" />
          <span className="sr-only">{tCommon('mapLoading')}</span>
        </div>
      ) : null}
      <div
        ref={containerRef}
        role="region"
        aria-label={t('mapAria')}
        className="h-full min-h-[320px] w-full"
      />
    </div>
  );
}

export { colorForCategory };
