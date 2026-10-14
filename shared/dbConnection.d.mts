import type { ConnectionOptions } from "mysql2";
export declare function mysqlOptionsFromUrl(url: string): ConnectionOptions & { host: string; database: string };
