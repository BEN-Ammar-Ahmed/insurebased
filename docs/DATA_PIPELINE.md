# Optional official-data pipeline

## Bundled Medicare assignment list (in use)

`data/medicare/assignment.bin` is a compact copy of the CMS Doctors and
Clinicians National Downloadable File (dataset `mj5m-pzi6`), keeping only
NPI and `ind_assgn` (Y = accepts assignment, M = may accept). The site answers
every Original Medicare check from this file: CMS's live API blocks requests
from cloud hosts such as Vercel and is slow (5–10s) when it does answer.

Refresh monthly, after CMS publishes a new release:

    npm run medicare:refresh          # streams the ~850 MB CSV from CMS; nothing large is saved
    npm test
    git add data/medicare/assignment.bin && git commit -m "data: refresh Medicare list (CMS release YYYY-MM-DD)"

The CMS release date is stored in the file and shown on every Medicare result
("Source updated …"). If the file is missing, the site falls back to the live
CMS API. Providers not in the file are labeled "Unable to verify", never "no".


## Current status

Implemented: schema, indexed runtime adapter, staged streaming CSV ingestion,
atomic publication, dry-run validation, source dates, imported assignment,
ZIP/ZCTA centroids, and address-coordinate records. No hosted database was
provisioned or nationwide source dataset downloaded. Database-backed imports
have not been integration-tested against PostgreSQL in this workspace. The
fixture dry run validates parsing; it is not a real healthcare import.

## Sources

- NPPES files: https://download.cms.gov/nppes/NPI_Files.html
- CMS national file: https://data.cms.gov/provider-data/dataset/mj5m-pzi6
- NUCC taxonomy: https://www.nucc.org/index.php/code-sets-mainmenu-41/provider-taxonomy-mainmenu-40/csv-mainmenu-57
- Census ZCTA: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
- Census matching: https://geocoding.geo.census.gov/geocoder/

Download and verify source releases outside Git or in ignored data/source/.
Pass the actual release date, not today's date by default. The importer does
not infer or certify file provenance.

## Import contracts

Set INGEST_DATABASE_URL in a protected environment. Run from the project root.
Use a separate ingestion role, not a public API key.

    npm run ingest -- nppes official-nppes.csv YYYY-MM-DD --taxonomy official-taxonomy.csv --dry-run
    npm run ingest -- nppes official-nppes.csv YYYY-MM-DD --taxonomy official-taxonomy.csv --replace
    npm run ingest -- nppes-locations pl_pfile.csv YYYY-MM-DD
    npm run ingest -- medicare official-cms.csv YYYY-MM-DD --replace
    npm run ingest -- zcta normalized-zcta.csv YYYY-MM-DD
    npm run ingest -- locations normalized-census-matches.csv YYYY-MM-DD

Use --replace only for verified complete NPPES/CMS replacement files. It removes
records absent from the source batch. Do not use it for weekly incremental
files or filtered extracts. Without it, import is an upsert. Deactivation updates
require full replacement or a separate audited pipeline; do not assume an
incremental import removes old records.

- NPPES uses original CMS headers; only individuals are included.
- NPPES practice locations accepts the official `pl_pfile_*.csv` reference file and attaches non-primary locations to matching provider payloads. Run it after the main NPPES import.
- Taxonomy supports Code, Display Name, Classification, Specialization.
  Without taxonomy, code labels appear without invented specialties.
- Medicare: NPI (or npi), ind_assgn. Duplicate office rows aggregate Y stronger
  than M; unknown values remain unverified.
- ZCTA normalized CSV: GEOID, INTPTLAT, INTPTLONG (or zip, lat, lng).
  ZCTAs are statistical areas, not an exact postal ZIP directory.
- Locations normalized CSV: address_key, lat, lng,
  quality=census-address-match. Format keys with providerFullAddress(), trim,
  collapse whitespace, and lowercase. Only import genuine Census matches.

Rows stream in batches of 500 into a private temporary staging table; publication
is transactional. Failed parsing does not publish partial records. Verify disk,
staging space, source schema, dates, and deactivations before nationwide use.
The NPPES Practice Location Reference File can now be ingested with `nppes-locations`; it adds non-primary locations to matching providers. Address coordinates are still a separate preprocessing/import step so the runtime does not bulk-geocode every search.

## Deployment

Apply db/schema.sql with the ingestion role. Give the runtime role only USAGE
on provider_data and SELECT on its tables:

    grant usage on schema provider_data to doct_runtime;
    grant select on all tables in schema provider_data to doct_runtime;

Use pooled PostgreSQL for DATABASE_URL. The runtime pool has three connections
per instance and bounded timeouts. Ingestion needs one persistent connection
for session-specific staging tables. Self-hosting works; no paid service is
required by the code. Hosted free tiers may not fit nationwide NPPES records,
indexes, and staging. Measure storage before choosing a provider.

## Shared rate limiting

Redis credentials enable atomic INCR/PEXPIRE. Requests are limited by endpoint
and hashed client key. Configured shared-store failures produce 503; limit
exhaustion produces 429 with Retry-After. Missing credentials use a bounded
per-instance fallback so provider search continues. This is not a global quota.

As checked on 2026-10-05, Upstash lists 256 MB data, 10 GB monthly bandwidth,
and 500,000 monthly commands on its free tier. Lua scripts execute underlying
commands; capacity must be measured rather than treating every HTTP call as one
command. Current limits and pricing:
https://upstash.com/pricing/redis . No account was created or charges authorized.
Development and deployments without shared credentials use the local fallback.
Vercel identity uses its platform-forwarded IP header; other deployments must
sanitize x-forwarded-for at trusted ingress.

## Remaining prerequisites

Provide a real database, verified source files, shared Redis credentials, and
CMS Marketplace API key. Validate imports on staging PostgreSQL, source refresh,
deactivations, pool limits, and deployed runtime/network access before release.
