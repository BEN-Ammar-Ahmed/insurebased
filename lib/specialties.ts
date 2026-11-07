// One list of specialties for the whole site: the search wizard, the ZIP
// search filter and the city directory pages. The NPI registry files most
// specialties under terms people don't search for ("Cardiology" lives under
// "Cardiovascular Disease"), so each entry maps the plain label to the
// registry's query term, plus a pattern the provider's *primary* taxonomy
// must match (otherwise "Pediatrics" mostly returns pediatric nurse
// practitioners and "Cardiology" returns cardiology pharmacists).
export type Specialty = {
  slug: string;
  label: string;
  plural: string;
  query: string;
  primary: RegExp;
};

export const SPECIALTY_LIST: Specialty[] = [
  { slug: "family-medicine", label: "Family Medicine", plural: "Family medicine doctors", query: "Family Medicine", primary: /^family medicine/i },
  { slug: "internal-medicine", label: "Internal Medicine", plural: "Internal medicine doctors", query: "Internal Medicine", primary: /^internal medicine$/i },
  { slug: "pediatrics", label: "Pediatrics", plural: "Pediatricians", query: "Pediatrics", primary: /^pediatrics/i },
  { slug: "cardiology", label: "Cardiology", plural: "Cardiologists", query: "Cardiovascular Disease", primary: /^internal medicine, .*(cardio|cardiac|heart)/i },
  { slug: "dermatology", label: "Dermatology", plural: "Dermatologists", query: "Dermatology", primary: /^dermatology/i },
  { slug: "psychiatry", label: "Psychiatry", plural: "Psychiatrists", query: "Psychiatry", primary: /^psychiatry & neurology, .*psychiatry/i },
  { slug: "obstetrics-gynecology", label: "Obstetrics & Gynecology", plural: "OB-GYNs", query: "Obstetrics & Gynecology", primary: /^obstetrics & gynecology/i },
  { slug: "orthopaedic-surgery", label: "Orthopaedic Surgery", plural: "Orthopedic surgeons", query: "Orthopaedic Surgery", primary: /^orthopaedic surgery/i },
  { slug: "ophthalmology", label: "Ophthalmology", plural: "Ophthalmologists", query: "Ophthalmology", primary: /^ophthalmology/i },
  { slug: "optometrist", label: "Optometrist", plural: "Optometrists", query: "Optometrist", primary: /^optometrist/i },
  { slug: "dentist", label: "Dentist", plural: "Dentists", query: "Dentist", primary: /^dentist/i },
  { slug: "physical-therapist", label: "Physical Therapist", plural: "Physical therapists", query: "Physical Therapist", primary: /^physical therapist/i },
];

export function specialtyBySlug(slug: string): Specialty | undefined {
  return SPECIALTY_LIST.find(s => s.slug === slug);
}

export function specialtyByLabel(label: string): Specialty | undefined {
  const key = label.trim().toLowerCase();
  return SPECIALTY_LIST.find(s => s.label.toLowerCase() === key);
}
