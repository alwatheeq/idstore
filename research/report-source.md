# VW ID EV Service Center — Research Record

Audience: product owner, operations lead, solution architect, Supabase implementation team

Research date: 2026-09-03

Assumed launch market: Jordan, with multi-country configuration
Scope: workshop CRM, appointments, repair orders, VW ID-specific EV workflows, inventory, purchasing, estimates, invoicing, payments, customer portal, Supabase backend

## Direct answer

Build a multi-branch, multi-tenant workshop platform on Supabase/Postgres. Keep commercial transactions append-only after posting, use an immutable stock ledger, version service templates and estimates, and gate high-voltage work by both site capability and technician certification. Integrate with Volkswagen systems and Jordan's e-invoicing system through licensed, audited adapters rather than undocumented APIs.

## Assumptions and boundaries

- The first deployment is an independent or importer-authorized specialist workshop in Jordan; official Volkswagen dealer status is not assumed.
- Arabic and English, Asia/Amman time, JOD with three-decimal display, and a configurable tax engine are defaults.
- Tax rates, invoice wording, retention periods, technician qualification names, warranty entitlement, and VW system access must be validated locally before production.
- The product is an operational subledger, not a complete general ledger, payroll system, or OEM warranty adjudication platform.
- Vehicle repair procedures are never authored by this application. The work order links to the applicable licensed VW repair information and records the procedure/version used.

## Claim-to-source ledger

| Claim | Source | Publisher / date | URL | Confidence / access note |
|---|---|---|---|---|
| VW UK states all-electric ID vehicles use an inspection service every two years, not a mileage interval. | Electric Car Servicing & Maintenance | Volkswagen UK, current page accessed 2026-09-03 | https://www.volkswagen.co.uk/en/electric-and-hybrid/benefits-and-costs/looking-after-your-ev/service-and-maintenance.html | High; first-party. Market-specific, so the app must not hard-code it globally. |
| VW's described EV inspection covers charging components, battery health/capacity, brakes, lighting and tyres; service-plan material also mentions pollen filter, brake fluid and software diagnostics. | Electric Car Servicing & Maintenance; ID models aged 1–15 years | Volkswagen UK, current pages accessed 2026-09-03 | https://www.volkswagen.co.uk/en/electric-and-hybrid/benefits-and-costs/looking-after-your-ev/service-and-maintenance.html ; https://www.volkswagen.co.uk/en/owners-and-services/servicing-and-parts/buy-a-service-plan.html | High; first-party, but scope varies by market/model/date. |
| VW says opening a high-voltage battery requires a high-voltage service center and qualified high-voltage technicians. | ID. Service | Volkswagen Ireland, current page accessed 2026-09-03 | https://www.volkswagen.ie/en/owners-and-services/service-and-parts.html/__layer/layers/Aftersales/as-4/service-and-parts/service-and-parts/service-for-id/master.layer | High; first-party. Drives hard authorization gates. |
| VW states a new fully electric vehicle's usable battery energy content is warranted not to fall below 70% for eight years or 160,000 km, subject to guarantee terms. | ID. Service | Volkswagen Ireland, current page accessed 2026-09-03 | https://www.volkswagen.ie/en/owners-and-services/service-and-parts.html/__layer/layers/Aftersales/as-4/service-and-parts/service-and-parts/service-for-id/master.layer | High; first-party. Warranty eligibility still must be checked by market/VIN/terms. |
| VW product safety information warns that suspected battery damage may involve live high-voltage parts, toxic gases/fluids or fire and says HV work must be done by a suitably qualified, approved workshop. | Volkswagen Product Safety Information | Volkswagen UK, published circa 2024, accessed 2026-09-03 | https://www.volkswagen.co.uk/idhub/content/dam/onehub_master/downloads/product-safety/volkswagen-product-safety-information-en.pdf | High; first-party. The system should support quarantine, risk flags, escalation and safety records, not prescribe emergency response. |
| ODIS use requires an organization working context/Global User ID; GRP uses 2FA; certain security/component-protection work needs FAZIT/GeKo/SERMI authorization. | ODIS Service support and requirements; SERMI & FAZIT/GeKo authorization | Volkswagen erWin, accessed 2026-09-03 | https://erwin.vwgroup-datahub.com/odis-requirements ; https://erwin.vwgroup-datahub.com/geko-forms | High; first-party. Access differs by importer/country. |
| Volkswagen's Digital Service Schedule is available to registered organizations without purchasing a diagnostic license. | erWin Support Center | Volkswagen erWin, accessed 2026-09-03 | https://erwin.vwgroup-datahub.com/support-center | High; first-party. Actual write rights and market availability still require validation. |
| Jordan's phase-two e-invoicing framework requires qualifying local purchases from 2025-04-01 to be supported by invoices from the national system or an integrated system. | Phase two announcement | Jordan Income and Sales Tax Department, accessed 2026-09-03 | https://istd.gov.jo/AR//NewsDetails/%D8%A3%D8%A8%D9%88_%D8%B9%D9%84%D9%8A_%D8%B5%D8%AF%D9%88%D8%B1_%D8%A7%D9%84%D8%A5%D8%B7%D8%A7%D8%B1_%D8%A7%D9%84%D8%AA%D8%B4%D8%B1%D9%8A%D8%B9%D9%8A_%D9%84%D9%84%D8%A8%D8%AF%D8%A1_%D8%A8%D8%AA%D8%B7%D8%A8%D9%8A%D9%82_%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9_%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9_%D9%85%D9%86_%D9%86%D8%B8%D8%A7%D9%85_%D8%A7%D9%84%D9%81%D9%88%D8%AA%D8%B1%D8%A9 | High; official Arabic source. Legal applicability must be confirmed by an accountant. |
| Jordan's integration procedure uses a user number and secret key in API headers and sends an encoded XML invoice conforming to UBL 2.1. | Procedure Manual for Linking to the Jordanian National Electronic Invoicing System | Jordan Ministry of Finance / ISTD, accessed 2026-09-03 | https://istd.gov.jo/ebv4.0/root_storage/en/eb_list_page/procedure_manual_for_linking_to_the_jordanian_national_electronic_invoicing_system.pdf | High; first-party. The official manual itself says “UPL 2.1,” apparently a typo; screenshots/current Arabic guide indicate UBL 2.1. Validate the production schema and endpoint during certification. |
| Supabase requires RLS on exposed tables; grants and RLS are separate controls, and secret keys bypass RLS and must remain server-side. | Row Level Security; API keys | Supabase Docs, current pages accessed 2026-09-03 | https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/getting-started/api-keys | High; first-party and current. |
| Supabase Storage access is controlled through RLS; upsert needs INSERT, SELECT and UPDATE permission. | Storage Access Control | Supabase Docs, accessed 2026-09-03 | https://supabase.com/docs/guides/storage/security/access-control | High; first-party. |
| Supabase recommends Broadcast for scalable database-change subscriptions; Postgres Changes performs authorization per subscriber. | Subscribing to Database Changes; Postgres Changes | Supabase Docs, accessed 2026-09-03 | https://supabase.com/docs/guides/realtime/subscribing-to-database-changes ; https://supabase.com/docs/guides/realtime/postgres-changes | High; first-party. |
| Supabase Queues provides durable Postgres-native message delivery; Cron runs scheduled SQL/functions/HTTP jobs with documented concurrency/duration guidance. | Queues; Cron | Supabase Docs, accessed 2026-09-03 | https://supabase.com/docs/guides/queues ; https://supabase.com/docs/guides/cron | High; first-party. |
| Supabase database backups do not include Storage objects, so attachments need a separate backup/export policy. | Database Backups | Supabase Docs, accessed 2026-09-03 | https://supabase.com/docs/guides/platform/backups | High; first-party. |
| Relevant 2026 breaking changes include tighter Data API/OpenAPI access, a locked Realtime schema, and extension version handling changes. | Breaking Changes Changelog | Supabase, accessed 2026-09-03 | https://supabase.com/changelog?types=breaking-change | High; first-party. Design avoids client OpenAPI discovery and modifying the Realtime schema. |

## Evidence reconciliation and limitations

- VW service intervals and package content vary by country, model, model year, campaign and VIN. The UK two-year interval is evidence for a template, not a universal rule.
- The 70%/8-year/160,000-km statement is a warranty context indicator, not an automated approval rule or a substitute for the applicable warranty booklet.
- Public evidence confirms ODIS access prerequisites but not a stable public API for workshop-management synchronization. Treat ODIS as a technician-operated external system and support file/metadata import until a licensed integration is contracted.
- Jordan e-invoicing rules and payload schemas are operationally important and may change. Keep all jurisdiction logic behind a versioned adapter and obtain production certification.
- No primary source was found for a single universal EV technician certification taxonomy. The data model therefore stores configurable qualifications, issuer, scope, validity and evidence instead of assuming a universal L1/L2/L3 definition.

## Research stop rationale

The main decisions—VW-specific inspections, high-voltage access, diagnostics licensing, local invoicing, Supabase authorization, asynchronous integrations and backup boundaries—have current primary-source support. More broad searches would mainly duplicate evidence; remaining unknowns are deployment-specific commercial/legal decisions that require the importer, tax adviser and workshop operator rather than web research.
