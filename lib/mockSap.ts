import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const MOCK_SAP_SESSION_COOKIE = "mock_sap_session";

/** Server-component guard for the pages behind login. Redirects to the login page if not authenticated. */
export async function requireMockSapSession(): Promise<void> {
  const store = await cookies();
  if (store.get(MOCK_SAP_SESSION_COOKIE)?.value !== "ok") {
    redirect("/mock-sap");
  }
}

/**
 * Data layer for the mock SAP-like target under app/mock-sap/*.
 *
 * This exists only because the shared SAP sandbox credentials didn't work
 * for the duration of this take-home (see NEXT.md). It's a deliberately
 * separate module/table set from the real app so it's obvious what's
 * scaffolding and trivial to delete once real SAP access works — the
 * agents themselves are unmodified, they just get pointed at this URL via
 * SAP_URL instead of the real sandbox.
 */

let cachedSql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    const connectionString =
      process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL_UNPOOLED;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    cachedSql = neon(connectionString);
  }
  return cachedSql;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = Promise.all([
      sql`
        CREATE TABLE IF NOT EXISTS mock_sap_settings (
          id INT PRIMARY KEY DEFAULT 1,
          date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY'
        )
      `,
      sql`
        CREATE TABLE IF NOT EXISTS mock_sap_orders (
          id SERIAL PRIMARY KEY,
          order_number TEXT NOT NULL,
          sold_to_party TEXT,
          material TEXT,
          quantity TEXT,
          sales_org TEXT,
          distribution_channel TEXT,
          division TEXT,
          customer_reference TEXT,
          created_at BIGINT NOT NULL
        )
      `,
    ]).then(() => undefined);
  }
  return schemaReady;
}

export async function getDateFormat(): Promise<string> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT date_format FROM mock_sap_settings WHERE id = 1`;
  if (rows.length === 0) {
    await sql`INSERT INTO mock_sap_settings (id, date_format) VALUES (1, 'MM/DD/YYYY') ON CONFLICT (id) DO NOTHING`;
    return "MM/DD/YYYY";
  }
  return rows[0].date_format as string;
}

export async function setDateFormat(value: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO mock_sap_settings (id, date_format) VALUES (1, ${value})
    ON CONFLICT (id) DO UPDATE SET date_format = ${value}
  `;
}

export interface MockOrderInput {
  soldToParty: string;
  material: string;
  quantity: string;
  salesOrg: string;
  distributionChannel: string;
  division: string;
  customerReference: string;
}

export async function createSalesOrder(input: MockOrderInput): Promise<string> {
  await ensureSchema();
  const sql = getSql();
  const orderNumber = String(5000000000 + Math.floor(Math.random() * 999999));
  await sql`
    INSERT INTO mock_sap_orders (
      order_number, sold_to_party, material, quantity, sales_org,
      distribution_channel, division, customer_reference, created_at
    ) VALUES (
      ${orderNumber}, ${input.soldToParty}, ${input.material}, ${input.quantity},
      ${input.salesOrg}, ${input.distributionChannel}, ${input.division},
      ${input.customerReference}, ${Date.now()}
    )
  `;
  return orderNumber;
}
