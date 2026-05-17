# Project Data

Raw hospital intake files are kept in `data/raw/` on local machines and ignored by git. Use the import scripts to turn reviewed source files into seed data or generated app data.

## Old patient register import

Place the legacy patient register at `data/old_patients.tsv` with these tab-separated columns:

`ppin`, `full_name`, `fathers_name`, `gender`, `address_line1`, `address_line2`, `address_line3`, `city`, `state`, `pin_code`

Then run:

```bash
npm run db:migrate
npm run db:import-old-patients
```

The import replaces existing patient-linked records by default, including sample patients, appointments, visits, bills, lab orders, IPD admissions, panchkarma schedules, and uploaded patient PDFs. Use append/upsert mode only when intentionally adding more rows:

```bash
npm --workspace backend run db:import-old-patients -- ../data/old_patients.tsv --append
```
