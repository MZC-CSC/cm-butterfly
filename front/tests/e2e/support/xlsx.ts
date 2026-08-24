/**
 * Builds a small .xlsx in memory.
 *
 * The connection import screen takes CSV or Excel, and until now only the CSV route was ever
 * exercised. Excel is what people actually hand each other, so it is the one the walkthrough shows
 * - which left the route the walkthrough depends on untested.
 *
 * ★ Written rather than kept as a file. The rows carry addresses and account names for whichever
 *   environment the run points at, and this suite lives in a public repository. Building it from
 *   the same values every other step reads keeps those out of the tree, and keeps the file in step
 *   with the environment instead of drifting from it.
 *
 * ★ Strings go in the shared table rather than inline. Both are valid, but the server parses this
 *   file and only one of the two shapes has been seen to work - the file Excel itself produces,
 *   which is this one.
 */
import { deflateRawSync, crc32 } from 'zlib';

const xml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const COL = (n: number): string => {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) {
    s = String.fromCharCode(65 + (i % 26)) + s;
  }
  return s;
};

/** One entry of the archive, ready to be written twice - locally and in the directory. */
interface Entry {
  name: string;
  body: Buffer;
  deflated: Buffer;
  crc: number;
}

function entry(name: string, text: string): Entry {
  const body = Buffer.from(text, 'utf-8');
  return { name, body, deflated: deflateRawSync(body), crc: crc32(body) };
}

/**
 * A zip, written by hand.
 *
 * Nothing here needs a library: the format is a run of files, each preceded by its own header, and
 * a table at the end saying where each one started.
 */
function zip(entries: Entry[]): Buffer {
  const chunks: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf-8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(e.crc, 14);
    local.writeUInt32LE(e.deflated.length, 18);
    local.writeUInt32LE(e.body.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, e.deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(8, 10); // deflate
    central.writeUInt32LE(e.crc, 16);
    central.writeUInt32LE(e.deflated.length, 20);
    central.writeUInt32LE(e.body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);

    offset += local.length + name.length + e.deflated.length;
  }

  const dir = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, dir, end]);
}

/** Turns rows of text into a workbook of one sheet. The first row is the header. */
export function buildXlsx(rows: string[][]): Buffer {
  // The shared table holds every distinct value once; cells point at it by position.
  const index = new Map<string, number>();
  for (const row of rows) {
    for (const cell of row) {
      if (cell !== '' && !index.has(cell)) index.set(cell, index.size);
    }
  }
  const strings = [...index.keys()];

  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) =>
          cell === ''
            ? ''
            : `<c r="${COL(c)}${r + 1}" t="s"><v>${index.get(cell)}</v></c>`,
        )
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  return zip([
    entry(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
        '</Types>',
    ),
    entry(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    entry(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    entry(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
        '</Relationships>',
    ),
    entry(
      'xl/sharedStrings.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">` +
        strings
          .map(s => `<si><t xml:space="preserve">${xml(s)}</t></si>`)
          .join('') +
        '</sst>',
    ),
    entry(
      'xl/worksheets/sheet1.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  ]);
}
