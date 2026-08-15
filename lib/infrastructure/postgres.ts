import { Pool } from "pg";

import { databaseConfig } from "@/config/database";

const poolOptions = databaseConfig.url
  ? { connectionString: databaseConfig.url }
  : {};

export const postgresPool = new Pool(poolOptions);
