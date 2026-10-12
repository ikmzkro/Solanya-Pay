import dotenv from "dotenv";
import path from "path";
const e = process.env.NODE_ENV === "production" ? "production" : "development";
dotenv.config({ path: path.join(__dirname, `.env.${e}`) });
