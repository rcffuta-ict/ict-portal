/**
 * A minimal ZIP writer — stored (uncompressed) entries only.
 *
 * Exists so a CSV backup can be ONE download containing one file per table, which is
 * what anyone expects from a spreadsheet export of a whole database. The alternatives
 * were worse: a dozen separate downloads, or a single pseudo-CSV with invented
 * section separators that no spreadsheet app can open.
 *
 * Why not a library: this repo has no zip dependency and AGENTS.md is explicit about
 * preferring what is already installed. The stored-entry format is a well-specified
 * ~80 lines (PKWARE APPNOTE 4.3), and compression buys little here — the payload is
 * already-small text that the browser gzips in transit anyway.
 *
 * Limits, deliberately: no compression, no zip64, no encryption (the bundle is
 * encrypted separately, as a whole, in src/lib/backup-crypto.ts). Fine for files well
 * under 4GB, which a fellowship backup always is.
 */

/** CRC-32 (IEEE 802.3), table-driven. Required by the ZIP local file header. */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, which is what the ZIP header stores. */
function dosDateTime(date: Date): { time: number; date: number } {
    return {
        time:
            (Math.floor(date.getSeconds() / 2) & 0x1f) |
            ((date.getMinutes() & 0x3f) << 5) |
            ((date.getHours() & 0x1f) << 11),
        date:
            (date.getDate() & 0x1f) |
            (((date.getMonth() + 1) & 0x0f) << 5) |
            (((date.getFullYear() - 1980) & 0x7f) << 9),
    };
}

export interface ZipEntry {
    /** Path inside the archive, e.g. "tables/profiles.csv". */
    name: string;
    content: string | Buffer;
}

/**
 * Build a ZIP archive from entries.
 *
 * Layout is the standard three parts: each file's local header + data, then a central
 * directory describing them all, then the end-of-central-directory record pointing at it.
 */
export function createZip(entries: ZipEntry[], modifiedAt: Date = new Date()): Buffer {
    const { time, date } = dosDateTime(modifiedAt);

    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, "utf8");
        const data = Buffer.isBuffer(entry.content)
            ? entry.content
            : Buffer.from(entry.content, "utf8");
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); // local file header signature
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0x0800, 6); // flags: UTF-8 filenames
        local.writeUInt16LE(0, 8); // method: 0 = stored
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18); // compressed size
        local.writeUInt32LE(data.length, 22); // uncompressed size
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28); // extra field length

        locals.push(local, nameBuf, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); // central directory signature
        central.writeUInt16LE(20, 4); // version made by
        central.writeUInt16LE(20, 6); // version needed
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30); // extra
        central.writeUInt16LE(0, 32); // comment
        central.writeUInt16LE(0, 34); // disk number
        central.writeUInt16LE(0, 36); // internal attrs
        central.writeUInt32LE(0, 38); // external attrs
        central.writeUInt32LE(offset, 42); // offset of local header

        centrals.push(central, nameBuf);

        offset += local.length + nameBuf.length + data.length;
    }

    const centralBuf = Buffer.concat(centrals);

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
    end.writeUInt16LE(0, 4); // disk number
    end.writeUInt16LE(0, 6); // disk with central directory
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([...locals, centralBuf, end]);
}
