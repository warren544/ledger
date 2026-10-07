import "../src/lib/load-env.js";
import { runMongoSetup } from "../src/server/mongo.js";
await runMongoSetup(process.env, process.argv.slice(2).includes("--confirm-synthetic"));
