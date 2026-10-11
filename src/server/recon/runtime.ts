import { connectMongo } from "../../adapters/mongo/index.js";
import { readReconMongoConfig } from "../mongo.js";
import { createReconRepository } from "./repository.js";
import { createReconService } from "./service.js";

/** Server-only route seam; app handlers never import the Mongo adapter directly. */
export async function withConnectedReconService<T>(work: (service: ReturnType<typeof createReconService>) => Promise<T>): Promise<T> {
  const config = readReconMongoConfig();
  const client = await connectMongo(config);
  try { return await work(createReconService(createReconRepository(client.db(config.database)))); }
  finally { await client.close(); }
}
