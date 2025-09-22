import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config/env";

const validExpirationTimes = ["1h", "7d", "30d"] as const;
type ValidExpirationTime = (typeof validExpirationTimes)[number];

const validateExpirationTime = (expiresIn: string): ValidExpirationTime => {
  if (validExpirationTimes.includes(expiresIn as ValidExpirationTime)) {
    return expiresIn as ValidExpirationTime;
  }
  return "1h";
};

export const generateToken = (payload: object): string => {
  const expirationTime = validateExpirationTime(config.jwtExpiresIn);

  const options: SignOptions = {
    expiresIn: expirationTime,
    issuer: "sappers-backend",
    audience: "sappers-users",
  };

  return jwt.sign(payload, config.jwtSecret, options);
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, config.jwtSecret, {
      issuer: "sappers-backend",
      audience: "sappers-users",
    });
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
