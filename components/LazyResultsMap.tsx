"use client";

import MapBoundary from "./MapBoundary";
import dynamic from "next/dynamic";
import type { Doctor } from "@/lib/npi";
import type { LatLng } from "@/lib/geo";
import type { CoverageDisplay } from "@/lib/coverage";

type MapDoctor = Doctor & { coverage?: CoverageDisplay };

export type LazyResultsMapProps = {
  center: LatLng;
  centerLabel?: string;
  doctors: MapDoctor[];
  numbers?: Map<string, number>;
  activeNpi?: string | null;
  query: string;
  refiningLocations?: boolean;
  onSearchArea?: (lat: number, lng: number) => void;
};

function MapLoading() {
  return (
    <div aria-label="Loading map" className="map-skeleton" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}

const ResultsMap = dynamic<LazyResultsMapProps>(() => import("./ResultsMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function LazyResultsMap(props: LazyResultsMapProps) {
  return <MapBoundary><ResultsMap {...props} /></MapBoundary>;
}
