import "../src/lib/load-env.js";
import { runMongoSmoke } from "../src/server/mongo.js";
await runMongoSmoke(process.env);
