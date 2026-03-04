import { generateToken } from "../config/generateToken.js";
import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { User } from "../model/User.js";

export const loginUser = TryCatch(async (req, res) => {
  const { email, password } = req.body;

  const rateLimitKey = `otp:rateLimit:${email}`;
  const rateLimit = await redisClient.get(rateLimitKey);
  console.log("Rate limit value:", rateLimit);
  if (rateLimit) {
    return res
      .status(429)
      .json({ message: "Too many OTP requests. Please try again later." });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpKey = `otp:${email}`;
  await redisClient.set(otpKey, otp, { EX: 300 });
  await redisClient.set(rateLimitKey, "true", { EX: 60 });

  const message = {
    to: email,
    subject: "Your OTP Code",
    body: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
  };

  await publishToQueue("send-otp", message);
  res.status(200).json({ message: "OTP sent to email" });
});

export const verifyUser = TryCatch(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }
  const otpKey = `otp:${email}`;
  const storedOtp = await redisClient.get(otpKey);

  if (storedOtp === otp) {
    await redisClient.del(otpKey);
    let user = await User.findOne({ email });
    if (!user) {
      const name = email.split("@")[0];
      user = new User({ email, name });
      await user.save();
    }
    const token = generateToken(user);
    res.status(200).json({ message: "OTP verified", user, token });
  } else {
    res.status(400).json({ message: "Invalid OTP" });
  }
});

export const myProfile = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  res.json(user);
});

export const updateUser = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user1 = req.user;
  const userId = user1?._id;
  if (!userId) {
    return res.status(400).json({ message: "User ID is missing" });
  }
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }
  let user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const token = generateToken(user);
  user.name = name;
  await user.save();
  res.json({
    message: "Name updated successfully",
    user,
    token,
  });
});

export const getAllUsers = TryCatch(async (req: AuthenticatedRequest, res) => {
  const users = await User.find();
  res.json(users);
});

export const getAUser = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(user);
});
