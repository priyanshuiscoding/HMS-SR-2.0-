import { getDepartments } from "../../data/store.js";
import {
  createUser,
  getUsersSummaryFromDatabase,
  getUserById,
  listDoctors,
  listTherapists,
  listUsers,
  softDeleteUser,
  updateUser
} from "./users.service.js";

export async function usersListHandler(req, res, next) {
  try {
    res.json({ items: await listUsers(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function usersSummaryHandler(_req, res, next) {
  try {
    res.json(await getUsersSummaryFromDatabase());
  } catch (error) {
    next(error);
  }
}

export async function doctorsListHandler(_req, res, next) {
  try {
    res.json({ items: await listDoctors() });
  } catch (error) {
    next(error);
  }
}

export async function therapistsListHandler(_req, res, next) {
  try {
    res.json({ items: await listTherapists() });
  } catch (error) {
    next(error);
  }
}

export async function userDetailsHandler(req, res, next) {
  try {
    res.json({ item: await getUserById(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function createUserHandler(req, res, next) {
  try {
    res.status(201).json({ item: await createUser(req.body), message: "User created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function updateUserHandler(req, res, next) {
  try {
    res.json({ item: await updateUser(req.params.id, req.body), message: "User updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function deleteUserHandler(req, res, next) {
  try {
    res.json({ item: await softDeleteUser(req.params.id), message: "User deactivated successfully." });
  } catch (error) {
    next(error);
  }
}

export function departmentsListHandler(_req, res, next) {
  try {
    res.json({ items: getDepartments() });
  } catch (error) {
    next(error);
  }
}
