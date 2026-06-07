import {
  assignBed,
  createRoom,
  dischargeBed,
  getRoomDetails,
  getRoomMasters,
  getRoomsAvailability,
  listRooms,
  updateBedWorkflowStatus
} from "./rooms.service.js";

export async function roomMastersHandler(_req, res, next) {
  try {
    res.json(await getRoomMasters());
  } catch (error) {
    next(error);
  }
}

export async function listRoomsHandler(req, res, next) {
  try {
    res.json({ items: await listRooms(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function roomAvailabilityHandler(_req, res, next) {
  try {
    res.json(await getRoomsAvailability());
  } catch (error) {
    next(error);
  }
}

export async function roomDetailsHandler(req, res, next) {
  try {
    res.json(await getRoomDetails(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function createRoomHandler(req, res, next) {
  try {
    res.status(201).json({ ...(await createRoom(req.body)), message: "Room created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function assignBedHandler(req, res, next) {
  try {
    res.status(201).json({
      ...(await assignBed(req.params.roomId, req.params.bedId, { ...req.body, assignedBy: req.user.sub })),
      message: "Bed assigned successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function dischargeBedHandler(req, res, next) {
  try {
    res.json({
      ...(await dischargeBed(req.params.roomId, req.params.bedId, req.body)),
      message: "Bed discharged successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function bedWorkflowStatusHandler(req, res, next) {
  try {
    res.json({
      ...(await updateBedWorkflowStatus(req.params.roomId, req.params.bedId, req.body, req.user)),
      message: "Bed workflow status updated successfully."
    });
  } catch (error) {
    next(error);
  }
}
