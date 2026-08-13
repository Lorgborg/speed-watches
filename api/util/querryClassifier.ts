// util/queryClassifier.ts
import { z } from "zod"
import { sql } from "./services.ts"

type FieldRole = "where" | "value" | "order" | "ignore"
const KNOWN_ROLES: FieldRole[] = ["where", "value", "order"]

interface FieldDescriptor {
    role: FieldRole
    /** Explicit column override from "role:column" or "role:table.column" syntax */
    column?: string
}

function parseFieldDescriptor(fieldSchema: z.ZodTypeAny): FieldDescriptor {
    let schema: any = fieldSchema
    while (schema && !schema.description && schema._def && "innerType" in schema._def) {
        schema = schema._def.innerType
    }
    const desc = schema?.description as string | undefined
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
    parsed: Record<string, any>
) {
    const where: any[] = []
    const values: Record<string, any> = {}
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

export function buildWhereClause(conditions: any[]) {
  if (conditions.length === 0) return sql`TRUE`
  return conditions.reduce((acc, cur) => sql`${acc} AND ${cur}`)
}

export function buildValueClause(values: Record<string, any>) {
  const entries = Object.entries(values)
  if (entries.length === 0) {
    // Returning an empty fragment avoids breaking the query,
    // but the caller should ideally check and abort early.
    return sql``
  }

  // Build an array of "column = value" fragments
  const setFragments = entries.map(
    ([col, val]) => sql`${sql(col)} = ${val}`
  )

  // Join with commas using sql.reduce
  return setFragments.reduce((acc, frag) => sql`${acc}, ${frag}`)
}