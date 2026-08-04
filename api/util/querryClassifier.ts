// util/queryClassifier.ts
import { z } from "zod"
import { sql } from "./services.ts"

type FieldRole = "where" | "value" | "order" | "ignore"
const KNOWN_ROLES: FieldRole[] = ["where", "value", "order"]

function getFieldRole(fieldSchema: z.ZodTypeAny): FieldRole {
    let schema: any = fieldSchema
    while (schema && !schema.description && schema._def && "innerType" in schema._def) {
        schema = schema._def.innerType
    }
    const desc = schema?.description as string | undefined
    return (desc && KNOWN_ROLES.includes(desc as FieldRole)) ? (desc as FieldRole) : "ignore"
}

function toSnakeCase(key: string) {
    // return all string after any capital letters
    return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

// Accept the shape record directly instead of z.ZodObject<T> —
// avoids the ZodObject<T> generic ever needing to structurally
// match against zod's internal $ZodType.
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

        const column = toSnakeCase(key)
        switch (getFieldRole(shape[key])) {
            case "where":
                where.push(sql`${sql(column)} = ${value}`)
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