import express from "express";
import {
  getAllUsers,
  getAUser,
  loginUser,
  myProfile,
  updateUser,
  verifyUser,
} from "../controllers/user.js";
import isAuth from "../middleware/isAuth.js";

const routes = express.Router();
routes.post("/login", loginUser);
routes.post("/verify", verifyUser);
routes.get("/me", isAuth, myProfile);
routes.post("/user/update", isAuth, updateUser);
routes.get("/user/all", isAuth, getAllUsers);
routes.get("/user/:id", getAUser);

export default routes;
