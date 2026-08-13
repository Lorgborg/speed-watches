// util/queryClassifier.ts
import { z } from "zod"
import type postgres from "postgres"
import { sql } from "../../config/services.ts"

/** A value that can be safely interpolated into a `postgres` sql template. */
type SqlValue =
  | null
  | boolean
  | number
  | string
  | Date
  | Uint8Array
  | readonly SqlValue[]

/** A `sql` template fragment (e.g. `sql`col = ${value}``). */
type SqlFragment = postgres.PendingQuery<postgres.Row[]>

type FieldRole = "where" | "value" | "order" | "ignore"
const KNOWN_ROLES: FieldRole[] = ["where", "value", "order"]

interface FieldDescriptor {
  role: FieldRole
  /** Explicit column override from "role:column" or "role:table.column" syntax */
  column?: string
}

function parseFieldDescriptor(fieldSchema: z.ZodTypeAny): FieldDescriptor {
  let schema: z.ZodTypeAny = fieldSchema
  while (!schema.description && "innerType" in schema._def) {
    schema = schema._def.innerType as z.ZodTypeAny
  }
  const desc = schema.description as string | undefined
  if (!desc) return { role: "ignore" }

  // Supports both plain "where" and qualified "where:table.column"
  const [rolePart, ...columnParts] = desc.split(":")
  const role = rolePart as FieldRole
  if (!KNOWN_ROLES.includes(role)) return { role: "ignore" }

  const column = columnParts.length > 0 ? columnParts.join(":") : undefined
  return { role, column }
}

function toSnakeCase(key: string) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/** Builds a properly-escaped column reference, handling "table.column" qualifiers. */
function columnRef(column: string) {
  if (column.includes(".")) {
    const [table, col] = column.split(".")
    return sql`${sql(table)}.${sql(col)}`
  }
  return sql(column)
}

export function classifyQueryFields(
  shape: Record<string, z.ZodTypeAny>,
  parsed: Record<string, SqlValue | undefined>
) {
  const where: SqlFragment[] = []
  const values: Record<string, SqlValue> = {}
  const order: { column: string; direction: "asc" | "desc" }[] = []

  for (const key of Object.keys(shape)) {
    const value = parsed[key]
    if (value === undefined) continue

    const { role, column: explicitColumn } = parseFieldDescriptor(shape[key])
    const column = explicitColumn ?? toSnakeCase(key)

    switch (role) {
      case "where":
        where.push(sql`${columnRef(column)} = ${value}`)
        break
      case "value":
        values[column] = value
        break
      case "order":
        order.push({ column, direction: value === "desc" ? "desc" : "asc" })
        break
      default:
        break
    }
  }

  return { where, values, order }
}

export function buildWhereClause(conditions: SqlFragment[]) {
  if (conditions.length === 0) return sql`TRUE`
  return conditions.reduce((acc, cur) => sql`${acc} AND ${cur}`)
}

export function buildValueClause(values: Record<string, SqlValue>) {
  const entries = Object.entries(values)
  if (entries.length === 0) {
    throw new Error("buildValueClause: no value fields supplied — validate before calling")
  }

  // Build an array of "column = value" fragments
  const setFragments = entries.map(
    ([col, val]) => sql`${sql(col)} = ${val}`
  )

  // Join with commas using sql.reduce
  return setFragments.reduce((acc, frag) => sql`${acc}, ${frag}`)
}