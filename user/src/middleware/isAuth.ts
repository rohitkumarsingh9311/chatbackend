import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../model/User.js";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const token = authHeader.split(" ")[1];

    const decodedValue = jwt.verify(
      token as string,
      process.env.JWT_SECRET as string,
    ) as JwtPayload;
    if (!decodedValue || !decodedValue.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    req.user = decodedValue.user as IUser;
    next();
  } catch (error) {
    res.status(500).json({ message: "JWT error: Internal Server Error" });
  }
};

export default isAuth;
