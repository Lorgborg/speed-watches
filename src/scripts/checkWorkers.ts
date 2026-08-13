// Diagnostic: verifies each Riot API token in .env is accepted by Riot.
// A 401 means the key is invalid or expired (the `[riot-worker-N] ... 401`
// failures in the logs). Prints one line per token and exits non-zero if any
// token is unusable.
import "dotenv/config"
import axios from "axios"
import { getRiotTokens } from "../riot/riotTokens.ts"

type CheckResult = {
  index: number
  workerLabel: string
  ok: boolean
  verdict: string
  status: string
  detail: string
}

// Bogus account that can never exist — a valid key gets a 404 ("data not
// found"), an invalid/expired key gets a 401. Same endpoint and auth header
// as the failing summonerNameToId call.
const GAME_NAME = "speedwatchesprobe"
const TAG_LINE = "0000"
const URL = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${GAME_NAME}/${TAG_LINE}`

async function checkToken(index: number, token: string): Promise<CheckResult> {
  const workerLabel =
    index === 0
      ? "leagueApi1 (MAIN)"
      : `leagueApi${index + 1} (worker-${index})`
  try {
    const res = await axios.get(URL, {
      headers: { "X-Riot-Token": token },
      timeout: 15_000,
    })
    return {
      index,
      workerLabel,
      ok: true,
      verdict: "OK",
      status: String(res.status),
      detail: "token accepted",
    }
  } catch (e: unknown) {
    const err = e as {
      response?: { status?: number; data?: { status?: { message?: string } } }
      code?: string
      message?: string
    }
    const status = err.response?.status
    const detail = err.response?.data?.status?.message ?? err.message

    if (status === 404) {
      return {
        index,
        workerLabel,
        ok: true,
        verdict: "OK",
        status: "404",
        detail: "token accepted (bogus account not found)",
      }
    }
    if (status === 401) {
      return {
        index,
        workerLabel,
        ok: false,
        verdict: "FAIL",
        status: "401",
        detail: `key invalid or expired: ${detail}`,
      }
    }
    if (status === 403) {
      return {
        index,
        workerLabel,
        ok: false,
        verdict: "FAIL",
        status: "403",
        detail: `key forbidden: ${detail}`,
      }
    }
    if (status === 429) {
      return {
        index,
        workerLabel,
        ok: true,
        verdict: "WARN",
        status: "429",
        detail: `rate limited: ${detail}`,
      }
    }
    if (status) {
      return {
        index,
        workerLabel,
        ok: true,
        verdict: "WARN",
        status: String(status),
        detail: `unexpected status: ${detail}`,
      }
    }
    return {
      index,
      workerLabel,
      ok: false,
      verdict: "UNKNOWN",
      status: "network",
      detail: `no response: ${err.code ?? err.message}`,
    }
  }
}

async function main(): Promise<void> {
  const tokens = getRiotTokens()
  console.log(`Checking ${tokens.length} Riot token(s) against ${URL}...\n`)

  const results = await Promise.all(tokens.map((token, i) => checkToken(i, token)))

  for (const r of results) {
    console.log(`${r.verdict.padEnd(7)} ${r.workerLabel.padEnd(26)} [${r.status}] ${r.detail}`)
  }

  const failed = results.filter((r) => !r.ok)
  const warned = results.filter((r) => r.ok && r.verdict === "WARN")
  console.log(
    `\n${results.length - failed.length}/${tokens.length} tokens usable (${warned.length} rate-limited/warned)`
  )
  if (failed.length > 0) {
    console.log("Failing:", failed.map((r) => r.workerLabel).join(", "))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("check failed:", e)
  process.exit(1)
})
