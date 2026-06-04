import { lookup } from 'dns/promises';
import { isIP } from 'net';

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

function normalizeHostname(hostname: string): string {
    return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function parseIpv4(address: string): number[] | null {
    const parts = address.split('.');
    if (parts.length !== 4) return null;

    const bytes = parts.map(part => Number(part));
    if (
        bytes.some(
            byte =>
                !Number.isInteger(byte) ||
                byte < 0 ||
                byte > 255 ||
                !/^\d{1,3}$/.test(String(byte))
        )
    ) {
        return null;
    }

    return bytes;
}

function isBlockedIpv4(address: string): boolean {
    const bytes = parseIpv4(address);
    if (!bytes) return true;

    const [a, b, c, d] = bytes;

    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && c === 0) ||
        (a === 192 && b === 0 && c === 2) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113) ||
        a >= 224 ||
        (a === 255 && b === 255 && c === 255 && d === 255)
    );
}

function isBlockedIpv6(address: string): boolean {
    const normalized = address.toLowerCase();
    const mappedIpv4 = normalized.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
    const mappedHexIpv4 = normalized.match(
        /(?:::ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/
    );

    if (mappedIpv4) {
        return isBlockedIpv4(mappedIpv4[1]);
    }

    if (mappedHexIpv4) {
        const high = parseInt(mappedHexIpv4[1], 16);
        const low = parseInt(mappedHexIpv4[2], 16);
        const mappedAddress = [
            (high >> 8) & 255,
            high & 255,
            (low >> 8) & 255,
            low & 255,
        ].join('.');

        return isBlockedIpv4(mappedAddress);
    }

    return (
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb') ||
        normalized.startsWith('ff') ||
        normalized.startsWith('2001:db8:') ||
        normalized === '2001:db8::'
    );
}

function isBlockedIpAddress(address: string): boolean {
    const ipVersion = isIP(address);

    if (ipVersion === 4) {
        return isBlockedIpv4(address);
    }

    if (ipVersion === 6) {
        return isBlockedIpv6(address);
    }

    return true;
}

function isBlockedHostname(hostname: string): boolean {
    return (
        BLOCKED_HOSTNAMES.has(hostname) ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
    );
}

async function resolveHostname(hostname: string): Promise<string[]> {
    const records = await lookup(hostname, {
        all: true,
        verbatim: false,
    });

    return records.map(record => record.address);
}

export async function assertSafeCaptureUrl(url: string): Promise<void> {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error(
            `Blocked unsafe capture URL: ${url} is not a valid URL`
        );
    }

    if (!SAFE_PROTOCOLS.has(parsedUrl.protocol)) {
        throw new Error(
            `Blocked unsafe capture URL: ${parsedUrl.protocol || 'unknown'} URLs are not allowed`
        );
    }

    const hostname = normalizeHostname(parsedUrl.hostname);
    if (!hostname || isBlockedHostname(hostname)) {
        throw new Error(
            `Blocked unsafe capture URL: ${parsedUrl.hostname} is not an allowed host`
        );
    }

    if (isIP(hostname)) {
        if (isBlockedIpAddress(hostname)) {
            throw new Error(
                `Blocked unsafe capture URL: ${hostname} is not an allowed destination`
            );
        }
        return;
    }

    const addresses = await resolveHostname(hostname);
    if (addresses.length === 0) {
        throw new Error(
            `Blocked unsafe capture URL: ${hostname} did not resolve to an address`
        );
    }

    const blockedAddress = addresses.find(address =>
        isBlockedIpAddress(address)
    );
    if (blockedAddress) {
        throw new Error(
            `Blocked unsafe capture URL: ${hostname} resolves to unsafe address ${blockedAddress}`
        );
    }
}
