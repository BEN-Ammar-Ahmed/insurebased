import type { ReactNode } from "react";
import Link from "next/link";
import type { Doctor } from "@/lib/npi";
import type { CoverageDisplay } from "@/lib/coverage";
import { CoverageBadge } from "./CoverageBadge";
import { PrimaryDirectionsLink } from "./DirectionsLinks";
import { ChevronRightIcon, MapPinIcon, PhoneIcon } from "./Icons";

// One provider in a list: number (matches its map pin), name, kind of doctor,
// distance, address, one coverage line, then Call / Directions / Profile.
// Used by results and by the server-rendered city pages (which pass their own
// streamed badge).
export default function DoctorCard({ doctor, query, badge, pendingText, number, active, onActivate }: {
  doctor: Doctor & { coverage?: CoverageDisplay };
  query: string;
  badge?: ReactNode;
  pendingText?: string;
  number?: number;
  active?: boolean;
  onActivate?(npi: string | null): void;
}) {
  const cityLine = [doctor.city, [doctor.state, doctor.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const href = "/doctor/" + doctor.npi + query;
  const hover = onActivate ? {
    onMouseEnter: () => onActivate(doctor.npi),
    onMouseLeave: () => onActivate(null),
    onFocus: () => onActivate(doctor.npi),
  } : {};
  return (
    <article className="card doctor-card" data-active={active ? "true" : undefined} {...hover}>
      <div className="doctor-card-head">
        {number !== undefined && <span className="doctor-card-num" aria-hidden="true">{number}</span>}
        <div className="doctor-card-title">
          <h2 className="doctor-card-name"><Link href={href}>{doctor.name}</Link></h2>
          <p className="doctor-card-specialty">{doctor.specialty}</p>
        </div>
        {doctor.distanceMi !== null && <span className="doctor-card-distance">{doctor.distanceMi} mi</span>}
      </div>
      <p className="doctor-card-address">
        <MapPinIcon size={16} className="fld-icon" />
        <span>
          {doctor.placeName && <span className="doctor-card-place">{doctor.placeName}</span>}
          {doctor.address1}{doctor.address1 && cityLine ? ", " : ""}{cityLine}
          {doctor.addressKind === "mailing" ? " (mailing address)" : ""}
        </span>
      </p>
      {pendingText
        ? <span className="badge-neutral" role="status">{pendingText}</span>
        : badge ?? (doctor.coverage && <CoverageBadge coverage={doctor.coverage} />)}
      <div className="doctor-actions">
        {doctor.phone && <a className="doctor-action" href={"tel:" + doctor.phone.replace(/[^\d+]/g, "")}><PhoneIcon size={16} />Call</a>}
        {doctor.address1 && <PrimaryDirectionsLink doctor={doctor} className="doctor-action" />}
        <Link className="doctor-action doctor-action-main" href={href}>View profile<ChevronRightIcon size={16} /></Link>
      </div>
    </article>
  );
}
