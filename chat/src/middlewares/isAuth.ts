import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser | null;
}

export const isAuth = async (
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
    req.user = decodedValue.user as IUser;
    next();
  } catch (error) {
    res.status(401).json({ message: " jwt Unauthorized" });
  }
};

export default isAuth;
