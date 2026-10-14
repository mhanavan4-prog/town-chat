// Server-side image metadata stripping: an accepted image must not carry EXIF
// (GPS location!), XMP, ICC or comment data to other players or into evidence,
// even if a crafted client sends a raw photo with those markers intact.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-imgstrip-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const { sanitizeImage, stripImageMetadata } = global.__testHooks;

  // ── A JPEG with an APP1 EXIF (GPS) segment + an APP2 ICC segment ──
  // SOI, APP1(Exif + fake GPS), APP2(ICC), DQT (kept), SOS + scan + EOI.
  function seg(marker, payload) {
    const len = payload.length + 2;
    return Buffer.concat([Buffer.from([0xFF, marker, (len >> 8) & 0xFF, len & 0xFF]), payload]);
  }
  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('GPSLatitude 40.76 GPSLongitude -73.98 SECRET-HOME')]);
  const iccPayload = Buffer.concat([Buffer.from('ICC_PROFILE\0'), Buffer.from('color profile bytes')]);
  const dqt = seg(0xDB, Buffer.alloc(64, 1));               // a benign non-metadata segment we must keep
  const scan = Buffer.concat([Buffer.from([0xFF, 0xDA, 0x00, 0x08, 0, 1, 0, 0, 0x3F, 0]), Buffer.from([0x12, 0x34, 0x56]), Buffer.from([0xFF, 0xD9])]);
  const jpeg = Buffer.concat([Buffer.from([0xFF, 0xD8]), seg(0xE1, exifPayload), seg(0xE2, iccPayload), dqt, scan]);
  const jpegUrl = 'data:image/jpeg;base64,' + jpeg.toString('base64');

  const out = sanitizeImage(jpegUrl);
  check('a valid jpeg data URL is still accepted', typeof out === 'string' && out.indexOf('data:image/jpeg;base64,') === 0);
  const outBuf = Buffer.from(out.split(',')[1], 'base64');
  check('EXIF/GPS marker is gone', outBuf.indexOf(Buffer.from('Exif\0\0')) === -1 && outBuf.indexOf(Buffer.from('SECRET-HOME')) === -1);
  check('ICC profile marker is gone', outBuf.indexOf(Buffer.from('ICC_PROFILE')) === -1);
  check('the real image data (DQT + scan) is preserved', outBuf.indexOf(dqt) !== -1 && outBuf[outBuf.length - 2] === 0xFF && outBuf[outBuf.length - 1] === 0xD9);
  check('stripped jpeg is smaller than the original', outBuf.length < jpeg.length, { before: jpeg.length, after: outBuf.length });

  // ── A PNG with an eXIf chunk + a tEXt chunk ──
  function pngChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); // CRC not validated by the stripper
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', Buffer.alloc(13, 0));
  const idat = pngChunk('IDAT', Buffer.from('pixelpixelpixel'));
  const exifChunk = pngChunk('eXIf', Buffer.from('MM\0* GPS SECRET-PNG-HOME'));
  const textChunk = pngChunk('tEXt', Buffer.from('Comment\0taken at home'));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  const png = Buffer.concat([sig, ihdr, exifChunk, textChunk, idat, iend]);
  const pngUrl = 'data:image/png;base64,' + png.toString('base64');

  const pout = sanitizeImage(pngUrl);
  const poutBuf = Buffer.from(pout.split(',')[1], 'base64');
  check('png is still accepted', typeof pout === 'string' && pout.indexOf('data:image/png;base64,') === 0);
  check('png eXIf + tEXt chunks are gone', poutBuf.indexOf(Buffer.from('SECRET-PNG-HOME')) === -1 && poutBuf.indexOf(Buffer.from('taken at home')) === -1);
  check('png pixel data (IDAT) is preserved', poutBuf.indexOf(Buffer.from('pixelpixelpixel')) !== -1);

  // ── GIF passes through (no EXIF in the format) ──
  const gifUrl = 'data:image/gif;base64,' + Buffer.from('GIF89a....').toString('base64');
  check('gif is accepted and passes through unchanged', sanitizeImage(gifUrl) === gifUrl);

  // ── Guards: non-images and oversize are still rejected ──
  check('a non-image data URL is rejected', sanitizeImage('data:text/html;base64,AAAA') === null);
  check('a non-string is rejected', sanitizeImage(null) === null);
  check('stripImageMetadata leaves no EXIF signature behind', stripImageMetadata(jpegUrl).indexOf('RXhpZg') === -1 || Buffer.from(stripImageMetadata(jpegUrl).split(',')[1], 'base64').indexOf(Buffer.from('Exif\0\0')) === -1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
