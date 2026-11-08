import type { ReactNode } from "react";
import Link from "next/link";
import type { Doctor } from "@/lib/npi";
import type { CoverageDisplay } from "@/lib/coverage";
import { CoverageBadge } from "./CoverageBadge";
import { PrimaryDirectionsLink } from "./DirectionsLinks";
import { PhoneIcon } from "./Icons";

// One provider in a list: name, kind of doctor and distance, address, one
// coverage line, then Call / Directions / View profile. Used by results and
// by the server-rendered city pages (which pass their own streamed badge).
export default function DoctorCard({ doctor, query, badge, pendingText }: {
  doctor: Doctor & { coverage?: CoverageDisplay };
  query: string;
  badge?: ReactNode;
  pendingText?: string;
}) {
  const address = [doctor.address1, [doctor.city, [doctor.state, doctor.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const href = "/doctor/" + doctor.npi + query;
  return (
    <article className="card doctor-card">
      <h2 className="doctor-card-name"><Link href={href}>{doctor.name}</Link></h2>
      <p className="doctor-card-specialty">{doctor.specialty}{doctor.distanceMi !== null ? ` · ${doctor.distanceMi} mi` : ""}</p>
      <p className="doctor-card-address">{address}{doctor.addressKind === "mailing" ? " (mailing address)" : ""}</p>
      {pendingText
        ? <span className="badge-neutral" role="status">{pendingText}</span>
        : badge ?? (doctor.coverage && <CoverageBadge coverage={doctor.coverage} />)}
      <div className="doctor-actions">
        {doctor.phone && <a href={"tel:" + doctor.phone.replace(/[^\d+]/g, "")}><PhoneIcon size={16} />Call</a>}
        {doctor.address1 && <PrimaryDirectionsLink doctor={doctor} />}
        <Link href={href}>View profile</Link>
      </div>
    </article>
  );
}
