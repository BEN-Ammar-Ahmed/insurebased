"use client";

import { useEffect, useState } from "react";
import type { Doctor } from "@/lib/npi";
import { appleDirectionsUrl, googleDirectionsUrl } from "@/lib/maps";
import { MapPinIcon } from "./Icons";

type Destination = Pick<Doctor, "address1" | "city" | "state" | "zip" | "lat" | "lng">;

function useAppleDevice() {
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    setIsApple(/iPhone|iPad|iPod|Macintosh/i.test(ua + " " + platform));
  }, []);
  return isApple;
}

export function PrimaryDirectionsLink({ doctor, className = "" }: { doctor: Destination; className?: string }) {
  const isApple = useAppleDevice();
  const href = isApple ? appleDirectionsUrl(doctor) : googleDirectionsUrl(doctor);
  const label = isApple ? "Directions in Apple Maps" : "Directions in Google Maps";
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} aria-label={label}>
      <MapPinIcon size={15} />
      Directions
    </a>
  );
}

export function DirectionsChoices({ doctor }: { doctor: Destination }) {
  const isApple = useAppleDevice();
  return (
    <div className="directions-choices" aria-label="Open directions">
      {isApple && (
        <a href={appleDirectionsUrl(doctor)} target="_blank" rel="noreferrer" className="btn-secondary">
          <MapPinIcon size={17} />
          Apple Maps
        </a>
      )}
      <a href={googleDirectionsUrl(doctor)} target="_blank" rel="noreferrer" className="btn-secondary">
        <MapPinIcon size={17} />
        {isApple ? "Google Maps" : "Get directions"}
      </a>
    </div>
  );
}
