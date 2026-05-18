# Project Data

Raw hospital intake files are kept in `data/raw/` on local machines and ignored by git. Use the import scripts to turn reviewed source files into seed data or generated app data.

## Old patient register import

Place the legacy patient register at `data/old_patients.tsv` with these tab-separated columns:

`ppin`, `full_name`, `fathers_name`, `gender`, `address_line1`, `address_line2`, `address_line3`, `city`, `state`, `pin_code`

The importer also accepts the newer client CSV format, including phone fields:

`ppin`, `full_name`, `fathers_name`, `phone_number`, `phone_number2`, `gender`, `address_line1`, `address_line2`, `address_line3`, `city`, `state`, `pin_code`

Keep real client files in an ignored local path such as `data/raw/patients.csv` or `data/Patient_PhoneNumberSRAIIMS.txt`; do not commit patient data.

Then run:

```bash
npm run db:migrate
npm --workspace backend run db:import-old-patients -- ../data/raw/patients.csv --dry-run
npm --workspace backend run db:import-old-patients -- ../data/raw/patients.csv
```

The import replaces existing patient-linked records by default, including sample patients, appointments, visits, bills, lab orders, IPD admissions, panchkarma schedules, and uploaded patient PDFs. Use append/upsert mode only when intentionally adding more rows:

```bash
npm --workspace backend run db:import-old-patients -- ../data/raw/patients.csv --append
```
