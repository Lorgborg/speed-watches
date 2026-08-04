import type { AxiosResponse } from "axios";
import riotApi from "../../utils/riot.ts";
import "dotenv/config"
import type { ParsedQs } from "qs"

const { leagueApi } = process.env

if(leagueApi == undefined) {
    throw Error("league api in api checker.ts is undefined. Where is your .env file?")
}

const riot = new riotApi(leagueApi)

const DISCORD_EPOCH = 1420070400000n; // Jan 1, 2015 UTC, in ms

export function checkDiscordId(id: string) {
    if (!/^\d{17,19}$/.test(id)) return false;

    try {
        const snowflake = BigInt(id);
        const timestampMs = Number((snowflake >> 22n) + DISCORD_EPOCH);
        const createdAt = new Date(timestampMs);

        const now = Date.now();
        const launch = 1420070400000; // Discord epoch itself
        return createdAt.getTime() >= launch && createdAt.getTime() <= now;
    } catch {
        return false;
    }
}

export async function checkPuuid(puuid: string): Promise<AxiosResponse | undefined> {
    try {
        return await riot.idToSummoner(puuid)
    } catch (e: any) {
        if(e.code == "ERR_BAD_REQUEST") {
            return undefined
        }
    }
}

import { z } from "zod"

export function getQueries<T extends z.ZodTypeAny>(
    query: ParsedQs,
    schema: T
): z.infer<T>{
    try {
        return schema.parse(query);
    } catch (e) {
        if (e instanceof z.ZodError) {
            throw new Error(e.issues.map(issue => formatZodIssue(issue)).join("; "));
        } else {
            throw e;
        }
    }
}

function formatZodIssue(issue: z.core.$ZodIssue): string {
    const path = issue.path.length ? issue.path.join(".") : "(root)";

    switch (issue.code) {
        case "invalid_type":
            return `${path}: expected ${issue.expected}, received ${issue.input === undefined ? "undefined" : typeof issue.input}`;

        case "too_small":
            return `${path}: too small (expected ${issue.origin} to be ${issue.inclusive ? ">=" : ">"} ${issue.minimum})`;

        case "too_big":
            return `${path}: too big (expected ${issue.origin} to be ${issue.inclusive ? "<=" : "<"} ${issue.maximum})`;

        case "invalid_format":
            // covers what v3 called invalid_string — email, url, uuid, regex, etc.
            return `${path}: invalid format (expected ${issue.format})`;

        case "not_multiple_of":
            return `${path}: not a multiple of ${issue.divisor}`;

        case "unrecognized_keys":
            return `${path}: unrecognized key(s) ${issue.keys.join(", ")}`;

        case "invalid_union":
            return `${path}: did not match any type in union`;

        case "invalid_key":
            return `${path}: invalid key in record/map`;

        case "invalid_element":
            return `${path}: invalid element in collection`;

        case "invalid_value":
            // replaces v3's invalid_literal / invalid_enum_value
            return `${path}: expected one of ${issue.values.map(v => JSON.stringify(v)).join(", ")}`;

        case "custom":
            return `${path}: ${issue.message}`;

        default:
            return `${path}: ${issue}`;
    }
}