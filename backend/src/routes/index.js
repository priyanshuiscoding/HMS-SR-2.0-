import { Router } from "express";

import { authenticate } from "../middleware/auth.js";
import { auditWrites } from "../middleware/audit.js";
import { authorize } from "../middleware/rbac.js";
import { appointmentsRouter } from "../modules/appointments/appointments.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { billingRouter } from "../modules/billing/billing.routes.js";
import { calendarRouter } from "../modules/calendar/calendar.routes.js";
import { certificatesRouter } from "../modules/certificates/certificates.routes.js";
import { inventoryRouter } from "../modules/inventory/inventory.routes.js";
import { hrRouter } from "../modules/hr/hr.routes.js";
import { ipdRouter } from "../modules/ipd/ipd.routes.js";
import { laboratoryRouter } from "../modules/laboratory/laboratory.routes.js";
import { opdRouter } from "../modules/opd/opd.routes.js";
import { panchkarmaRouter } from "../modules/panchkarma/panchkarma.routes.js";
import { patientsRouter } from "../modules/patients/patients.routes.js";
import { pharmacyRouter } from "../modules/pharmacy/pharmacy.routes.js";
import { reportsRouter } from "../modules/reports/reports.routes.js";
import { roomsRouter } from "../modules/rooms/rooms.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use(authenticate);
apiRouter.use(auditWrites);
apiRouter.use("/patients", patientsRouter);
apiRouter.use("/appointments", appointmentsRouter);
apiRouter.use("/opd", opdRouter);
apiRouter.use("/lab", laboratoryRouter);
apiRouter.use("/billing", billingRouter);
apiRouter.use("/calendar", calendarRouter);
apiRouter.use("/certificates", certificatesRouter);
apiRouter.use("/panchkarma", panchkarmaRouter);
apiRouter.use("/pharmacy", pharmacyRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/hr", hrRouter);
apiRouter.use("/ipd", ipdRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/users", usersRouter);

apiRouter.get("/system/overview", authorize(["admin", "doctor", "reception", "pharmacy", "accounts"]), (_req, res) => {
  res.json({
    hospital: "Shanti-Ratnam Healing With Happiness",
    phase: "Phase 10",
    modulesReady: ["auth", "rbac", "patients", "appointments", "calendar", "certificates", "opd", "ipd", "lab", "billing", "panchkarma", "pharmacy", "inventory", "hr", "rooms", "reports"],
    status: "active"
  });
});

export { apiRouter };

