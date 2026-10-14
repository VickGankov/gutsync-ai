import { describe, it, expect } from "vitest";
import { mysqlOptionsFromUrl } from "../shared/dbConnection.mjs";

describe("mysqlOptionsFromUrl", () => {
  it("forces verified TLS for a TiDB Cloud URL without ssl params", () => {
    const o = mysqlOptionsFromUrl("mysql://u%2Eroot:p%40ss@gateway01.us-west-2.prod.aws.tidbcloud.com:4000/gutsync");
    expect(o).toMatchObject({ host: "gateway01.us-west-2.prod.aws.tidbcloud.com", port: 4000, user: "u.root", password: "p@ss", database: "gutsync" });
    expect(o.ssl).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true });
  });

  it("forces TLS when the URL uses a Prisma-style or boolean ssl flag", () => {
    expect(mysqlOptionsFromUrl("mysql://u:p@db.example.com:4000/x?sslaccept=strict").ssl).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true });
    expect(mysqlOptionsFromUrl("mysql://u:p@db.example.com:4000/x?ssl=true").ssl).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true });
  });

  it("keeps an explicit ssl object from the URL", () => {
    const o = mysqlOptionsFromUrl('mysql://u:p@db.example.com/x?ssl={"rejectUnauthorized":true}');
    expect(o.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("leaves local databases unencrypted", () => {
    expect(mysqlOptionsFromUrl("mysql://root@127.0.0.1:3306/gutsync").ssl).toBeUndefined();
  });
});
