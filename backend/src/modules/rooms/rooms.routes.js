import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
import {
  assignBedHandler,
  bedWorkflowStatusHandler,
  createRoomHandler,
  dischargeBedHandler,
  roomAvailabilityHandler,
  roomDetailsHandler,
  roomMastersHandler,
  listRoomsHandler
} from "./rooms.controller.js";

const roomsRouter = Router();

roomsRouter.get("/masters", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), roomMastersHandler);
roomsRouter.get("/availability", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), roomAvailabilityHandler);
roomsRouter.get("/", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), listRoomsHandler);
roomsRouter.get("/:id", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), roomDetailsHandler);
roomsRouter.post("/", authorizeRolesOnly(["admin", "accounts"]), createRoomHandler);
roomsRouter.post("/:roomId/beds/:bedId/assign", authorizeRolesOnly(["admin", "doctor", "reception", "nursing"]), assignBedHandler);
roomsRouter.post("/:roomId/beds/:bedId/discharge", authorizeRolesOnly(["admin", "doctor", "reception", "nursing"]), dischargeBedHandler);
roomsRouter.put("/:roomId/beds/:bedId/status", authorizeRolesOnly(["admin", "reception", "nursing", "housekeeping"]), bedWorkflowStatusHandler);

export { roomsRouter };
