class TokenBucket {
    private max: number;
    private windowMs: number;
    private tokens: number;
    private queue: Array<() => void> = [];

    constructor(max: number, windowMs: number) {
        this.max = max;
        this.windowMs = windowMs;
        this.tokens = max;
        setInterval(() => this.refill(), windowMs);
    }

    private refill() {
        this.tokens = this.max;
        while (this.tokens > 0 && this.queue.length > 0) {
            this.tokens--;
            this.queue.shift()!();
        }
    }

    acquire(): Promise<void> {
        if (this.tokens > 0) {
            this.tokens--;
            return Promise.resolve();
        }
        return new Promise((resolve) => this.queue.push(resolve));
    }
}

const shortWindow = new TokenBucket(20, 1_000);
const longWindow = new TokenBucket(100, 120_000);

async function acquireSlot() {
    await Promise.all([shortWindow.acquire(), longWindow.acquire()]);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callRiot<T>(fn: () => Promise<T>, maxRetries = 8): Promise<T> {
    let attempt = 0;
    while (true) {
        await acquireSlot();
        try {
            return await fn();
        } catch (e: any) {
            const status = e?.response?.status ?? e?.status;
            if (status !== 429) throw e;

            attempt++;
            if (attempt > maxRetries) throw e;

            const retryAfterHeader =
                e?.response?.headers?.["retry-after"] ??
                e?.response?.headers?.get?.("retry-after");
            const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : Math.min(2 ** attempt, 60);

            console.log(`[riot] 429 received, waiting ${retryAfterSec}s (attempt ${attempt}/${maxRetries})`);
            await sleep(retryAfterSec * 1000 + 250);
        }
    }
}