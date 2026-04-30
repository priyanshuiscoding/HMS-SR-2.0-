import { app } from "./src/app.js";
import { env } from "./src/config/env.js";
import { logger } from "./src/config/logger.js";
import { assertProductionReady } from "./src/config/productionReadiness.js";
import { db } from "./src/data/store.js";
import { listAppointments } from "./src/modules/appointments/appointments.service.js";
import { loadBillingMirrorsFromDatabase } from "./src/modules/billing/billing.service.js";
import { loadInventoryMirrorsFromDatabase } from "./src/modules/inventory/inventory.service.js";
import { loadIpdMirrorsFromDatabase } from "./src/modules/ipd/ipd.service.js";
import { loadLabMirrorsFromDatabase } from "./src/modules/laboratory/laboratory.service.js";
import { loadOpdMirrorsFromDatabase } from "./src/modules/opd/opd.service.js";
import { loadPanchkarmaMirrorsFromDatabase } from "./src/modules/panchkarma/panchkarma.service.js";
import { listPatients } from "./src/modules/patients/patients.service.js";
import { loadPharmacyMirrorsFromDatabase } from "./src/modules/pharmacy/pharmacy.service.js";

async function bootstrap() {
  try {
    assertProductionReady(env);

    if (env.persistenceEnabled) {
      const persistedPatients = await listPatients();
      const persistedAppointments = await listAppointments();
      db.patients.splice(0, db.patients.length, ...persistedPatients);
      db.appointments.splice(0, db.appointments.length, ...persistedAppointments);
      await loadOpdMirrorsFromDatabase();
      await loadBillingMirrorsFromDatabase();
      await loadIpdMirrorsFromDatabase();
      await loadPanchkarmaMirrorsFromDatabase();
      await loadInventoryMirrorsFromDatabase();
      await loadPharmacyMirrorsFromDatabase();
      await loadLabMirrorsFromDatabase();
      logger.info("PostgreSQL persistence is enabled.");
    } else {
      logger.info("PostgreSQL persistence is disabled; using in-memory data only.");
    }

    app.listen(env.port, () => {
      logger.info(`HMS API running on port ${env.port}`);
    });
  } catch (error) {
    logger.error(`Backend bootstrap failed: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
