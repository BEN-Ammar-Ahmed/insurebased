import Link from "next/link";
import type { Doctor } from "@/lib/npi";
import type { CoverageDisplay } from "@/lib/coverage";
import { initialsOf } from "@/lib/options";
import { CoverageBadge } from "./CoverageBadge";
import { PrimaryDirectionsLink } from "./DirectionsLinks";
import { PhoneIcon } from "./Icons";

export default function DoctorCard({ doctor, query, coveragePending = false }: { doctor: Doctor & { coverage?: CoverageDisplay }; query: string; coveragePending?: boolean }) {
  const address = [doctor.address1, [doctor.city, [doctor.state, doctor.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  return <article className="card doctor-card">
    <div className="avatar" aria-hidden="true">{initialsOf(doctor.name)}</div>
    <div className="doctor-card-text">
      <div className="doctor-card-heading-row">
        <h2 className="doctor-card-name"><Link href={"/doctor/" + doctor.npi + query}>{doctor.name}</Link></h2>
        {doctor.distanceMi !== null && <span className="doctor-distance">{doctor.distanceMi} mi</span>}
      </div>
      <p className="doctor-card-specialty">{doctor.specialty}</p>
      <p className="doctor-card-meta">{address}{doctor.addressKind === "mailing" ? " (mailing address)" : ""}</p>
      {coveragePending
        ? <span className="badge-neutral badge-pending" role="status"><span className="pending-dot" aria-hidden="true" />Checking coverage…</span>
        : doctor.coverage && <CoverageBadge coverage={doctor.coverage} />}
      <div className="doctor-actions">
        {doctor.phone && <a href={"tel:" + doctor.phone.replace(/[^\d+]/g, "")}><PhoneIcon size={15} />Call</a>}
        {doctor.address1 && <PrimaryDirectionsLink doctor={doctor} />}
        <Link href={"/doctor/" + doctor.npi + query}>View profile</Link>
      </div>
    </div>
  </article>;
}
