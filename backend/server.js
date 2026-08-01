import { app } from "./src/app.js";
import { env } from "./src/config/env.js";
import { logger } from "./src/config/logger.js";
import { pgPool } from "./src/config/postgres.js";
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
      const [persistedPatients, persistedAppointments] = await Promise.all([listPatients(), listAppointments()]);
      db.patients.splice(0, db.patients.length, ...persistedPatients);
      db.appointments.splice(0, db.appointments.length, ...persistedAppointments);
      await Promise.all([
        loadOpdMirrorsFromDatabase(),
        loadBillingMirrorsFromDatabase(),
        loadIpdMirrorsFromDatabase(),
        loadPanchkarmaMirrorsFromDatabase(),
        loadInventoryMirrorsFromDatabase(),
        loadLabMirrorsFromDatabase()
      ]);
      // Pharmacy and inventory both refresh medicine mirrors; keep this final write ordered.
      await loadPharmacyMirrorsFromDatabase();
      logger.info("PostgreSQL persistence is enabled.");
    } else {
      logger.info("PostgreSQL persistence is disabled; using in-memory data only.");
    }

    const server = app.listen(env.port, () => {
      logger.info(`HMS API running on port ${env.port}`);
    });

    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`Received ${signal}; shutting down gracefully.`);

      const forceExit = setTimeout(() => {
        logger.error("Graceful shutdown timed out.");
        process.exit(1);
      }, 10000);
      forceExit.unref();

      server.close(async (error) => {
        clearTimeout(forceExit);
        await pgPool.end().catch((poolError) => logger.error(`Database shutdown failed: ${poolError.message}`));
        if (error) {
          logger.error(`HTTP shutdown failed: ${error.message}`);
          process.exit(1);
        }
        process.exit(0);
      });
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error(`Backend bootstrap failed: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
