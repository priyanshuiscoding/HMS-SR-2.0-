import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  completePanchkarmaSessionHandler,
  createPanchkarmaScheduleHandler,
  listPanchkarmaRecommendationsHandler,
  listPanchkarmaSchedulesHandler,
  panchkarmaWorkflowActionHandler,
  panchkarmaMastersHandler,
  panchkarmaScheduleDetailsHandler,
  panchkarmaSummaryHandler,
  panchkarmaTherapiesHandler,
  startPanchkarmaSessionHandler
} from "./panchkarma.controller.js";

const panchkarmaRouter = Router();

panchkarmaRouter.get(
  "/therapies",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  panchkarmaTherapiesHandler
);
panchkarmaRouter.get(
  "/masters",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  panchkarmaMastersHandler
);
panchkarmaRouter.get(
  "/summary",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  panchkarmaSummaryHandler
);
panchkarmaRouter.get(
  "/schedule",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  listPanchkarmaSchedulesHandler
);
panchkarmaRouter.get(
  "/recommendations",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  listPanchkarmaRecommendationsHandler
);
panchkarmaRouter.get(
  "/schedule/:id",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  panchkarmaScheduleDetailsHandler
);
panchkarmaRouter.post(
  "/schedule",
  authorize(["admin", "doctor", "reception", "therapist"]),
  createPanchkarmaScheduleHandler
);
panchkarmaRouter.post(
  "/schedule/:id/start",
  authorize(["admin", "doctor", "therapist"]),
  startPanchkarmaSessionHandler
);
panchkarmaRouter.post(
  "/schedule/:id/complete",
  authorize(["admin", "doctor", "therapist", "accounts"]),
  completePanchkarmaSessionHandler
);
panchkarmaRouter.put(
  "/schedule/:id/workflow",
  authorize(["admin", "doctor", "reception", "therapist", "accounts"]),
  panchkarmaWorkflowActionHandler
);

export { panchkarmaRouter };
