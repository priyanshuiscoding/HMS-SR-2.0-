Pharmacy/inventory repository migration
Move medicine masters, suppliers, stock batches, stock transactions, purchase orders, and dispensations fully to PostgreSQL.

Laboratory repository migration
Move lab orders, tests, results, reports, and lab billing links fully to PostgreSQL.

Reports repository/read-model migration
Move reports off temporary mirrors and onto PostgreSQL queries/views.

Production hardening
Add bcrypt, request validation, audit logs, backup scripts, deployment checks, and production security cleanup.