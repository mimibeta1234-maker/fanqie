// @ts-nocheck

import crypto from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto;
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

const moment = (ts) => {
  const d = new Date(Number(ts));
  return {
    format: (fmt) => d.toISOString().split('T')[0]
  };
};

const storage = {};
function write(key, value) {
  storage[key] = value;
}
function read(key) {
  return storage[key];
}

const settings$1 = {
  apiPreference: "app"
};

const shared_key = new Uint8Array([172, 37, 198, 125, 221, 143, 56, 193, 179, 122, 35, 72, 130, 142, 34, 46]).buffer;
const defaultConfig = {
  install_id: "2187355326270644",
  device_id: "2187355326004404",
  device_type: "P30",
  device_brand: "realme"
};
const _config = {
  currentConfig: defaultConfig
};

function GM_xmlhttpRequest(opts) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    if (opts.ontimeout) opts.ontimeout();
  }, 15000);

  fetch(opts.url, {
    method: opts.method || 'GET',
    headers: opts.headers,
    body: opts.data,
    signal: controller.signal
  }).then(async (res) => {
    clearTimeout(timeoutId);
    const text = await res.text();
    if (opts.onload) {
      opts.onload({
        status: res.status,
        statusText: res.statusText,
        responseText: text,
        responseHeaders: res.headers,
        finalUrl: res.url
      });
    }
  }).catch((err) => {
    clearTimeout(timeoutId);
    if (opts.onerror) opts.onerror({ error: err.message });
  });

  return { abort: () => controller.abort() };
}

const supportedMethods = new Set(["GET", "HEAD", "POST", "PUT", "DELETE"]);

function apiFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { signal } = options;
    const headers = normalizeHeaders(options.headers);
    const data = normalizeBody(options.body);
    const method = options.method ?? (data ? "POST" : "GET");

    let request;
    const abort = () => request?.abort();

    request = GM_xmlhttpRequest({
      url,
      method,
      headers,
      data,
      onload(response) {
        resolve(Object.assign(response, {
          json() {
            return JSON.parse(this.responseText);
          }
        }));
      },
      onerror(response) {
        reject(new Error("Network request failed: " + JSON.stringify(response)));
      },
      ontimeout() {
        reject(new Error("Network request timed out"));
      }
    });

    if (signal) {
      signal.addEventListener("abort", abort, { once: true });
    }
  });
}

  function normalizeHeaders(headers) {
    if (!headers) {
      return void 0;
    }
    return Object.fromEntries(new Headers(headers).entries());
  }
  function normalizeBody(body) {
    if (body == null) {
      return void 0;
    }
    if (body instanceof URLSearchParams) {
      return body.toString();
    }
    if (typeof body === "string" || body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData) {
      return body;
    }
    if (ArrayBuffer.isView(body)) {
      return body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength
      );
    }
    throw new TypeError(
      "GM_xmlhttpRequest does not support ReadableStream request bodies"
    );
  }
  function createRequestError(message, response) {
    const error = new TypeError(message);
    Object.defineProperty(error, "response", {
      configurable: true,
      enumerable: false,
      value: response
    });
    return error;
  }
  function rotateLeft(value, shiftBits) {
    return value << shiftBits | value >>> 32 - shiftBits;
  }
  function addUnsigned(left, right) {
    return left + right >>> 0;
  }
  function f(x, y, z) {
    return x & y | ~x & z;
  }
  function g(x, y, z) {
    return x & z | y & ~z;
  }
  function h(x, y, z) {
    return x ^ y ^ z;
  }
  function i(x, y, z) {
    return y ^ (x | ~z);
  }
  function ff(a, b, c, d, x, s, ac) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac)), s), b);
  }
  function gg(a, b, c, d, x, s, ac) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac)), s), b);
  }
  function hh(a, b, c, d, x, s, ac) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac)), s), b);
  }
  function ii(a, b, c, d, x, s, ac) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac)), s), b);
  }
  function convertToWordArray(bytes) {
    const wordCount = Math.ceil((bytes.length + 9) / 64) * 16;
    const words = new Array(wordCount).fill(0);
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
      const wordIndex = Math.floor(byteIndex / 4);
      const bytePosition = byteIndex % 4 * 8;
      words[wordIndex] = words[wordIndex] | bytes[byteIndex] << bytePosition;
    }
    const paddingWordIndex = Math.floor(bytes.length / 4);
    const paddingBytePosition = bytes.length % 4 * 8;
    words[paddingWordIndex] = words[paddingWordIndex] | 128 << paddingBytePosition;
    words[wordCount - 2] = bytes.length << 3;
    words[wordCount - 1] = bytes.length >>> 29;
    return words;
  }
  function wordToHex(value) {
    let hex2 = "";
    for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
      const byte = value >>> byteIndex * 8 & 255;
      hex2 += byte.toString(16).padStart(2, "0");
    }
    return hex2;
  }
  function md5(input) {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
    const words = convertToWordArray(bytes);
    let a = 1732584193;
    let b = 4023233417;
    let c = 2562383102;
    let d = 271733878;
    for (let k = 0; k < words.length; k += 16) {
      const aa = a;
      const bb = b;
      const cc = c;
      const dd = d;
      a = ff(a, b, c, d, words[k], 7, 3614090360);
      d = ff(d, a, b, c, words[k + 1], 12, 3905402710);
      c = ff(c, d, a, b, words[k + 2], 17, 606105819);
      b = ff(b, c, d, a, words[k + 3], 22, 3250441966);
      a = ff(a, b, c, d, words[k + 4], 7, 4118548399);
      d = ff(d, a, b, c, words[k + 5], 12, 1200080426);
      c = ff(c, d, a, b, words[k + 6], 17, 2821735955);
      b = ff(b, c, d, a, words[k + 7], 22, 4249261313);
      a = ff(a, b, c, d, words[k + 8], 7, 1770035416);
      d = ff(d, a, b, c, words[k + 9], 12, 2336552879);
      c = ff(c, d, a, b, words[k + 10], 17, 4294925233);
      b = ff(b, c, d, a, words[k + 11], 22, 2304563134);
      a = ff(a, b, c, d, words[k + 12], 7, 1804603682);
      d = ff(d, a, b, c, words[k + 13], 12, 4254626195);
      c = ff(c, d, a, b, words[k + 14], 17, 2792965006);
      b = ff(b, c, d, a, words[k + 15], 22, 1236535329);
      a = gg(a, b, c, d, words[k + 1], 5, 4129170786);
      d = gg(d, a, b, c, words[k + 6], 9, 3225465664);
      c = gg(c, d, a, b, words[k + 11], 14, 643717713);
      b = gg(b, c, d, a, words[k], 20, 3921069994);
      a = gg(a, b, c, d, words[k + 5], 5, 3593408605);
      d = gg(d, a, b, c, words[k + 10], 9, 38016083);
      c = gg(c, d, a, b, words[k + 15], 14, 3634488961);
      b = gg(b, c, d, a, words[k + 4], 20, 3889429448);
      a = gg(a, b, c, d, words[k + 9], 5, 568446438);
      d = gg(d, a, b, c, words[k + 14], 9, 3275163606);
      c = gg(c, d, a, b, words[k + 3], 14, 4107603335);
      b = gg(b, c, d, a, words[k + 8], 20, 1163531501);
      a = gg(a, b, c, d, words[k + 13], 5, 2850285829);
      d = gg(d, a, b, c, words[k + 2], 9, 4243563512);
      c = gg(c, d, a, b, words[k + 7], 14, 1735328473);
      b = gg(b, c, d, a, words[k + 12], 20, 2368359562);
      a = hh(a, b, c, d, words[k + 5], 4, 4294588738);
      d = hh(d, a, b, c, words[k + 8], 11, 2272392833);
      c = hh(c, d, a, b, words[k + 11], 16, 1839030562);
      b = hh(b, c, d, a, words[k + 14], 23, 4259657740);
      a = hh(a, b, c, d, words[k + 1], 4, 2763975236);
      d = hh(d, a, b, c, words[k + 4], 11, 1272893353);
      c = hh(c, d, a, b, words[k + 7], 16, 4139469664);
      b = hh(b, c, d, a, words[k + 10], 23, 3200236656);
      a = hh(a, b, c, d, words[k + 13], 4, 681279174);
      d = hh(d, a, b, c, words[k], 11, 3936430074);
      c = hh(c, d, a, b, words[k + 3], 16, 3572445317);
      b = hh(b, c, d, a, words[k + 6], 23, 76029189);
      a = hh(a, b, c, d, words[k + 9], 4, 3654602809);
      d = hh(d, a, b, c, words[k + 12], 11, 3873151461);
      c = hh(c, d, a, b, words[k + 15], 16, 530742520);
      b = hh(b, c, d, a, words[k + 2], 23, 3299628645);
      a = ii(a, b, c, d, words[k], 6, 4096336452);
      d = ii(d, a, b, c, words[k + 7], 10, 1126891415);
      c = ii(c, d, a, b, words[k + 14], 15, 2878612391);
      b = ii(b, c, d, a, words[k + 5], 21, 4237533241);
      a = ii(a, b, c, d, words[k + 12], 6, 1700485571);
      d = ii(d, a, b, c, words[k + 3], 10, 2399980690);
      c = ii(c, d, a, b, words[k + 10], 15, 4293915773);
      b = ii(b, c, d, a, words[k + 1], 21, 2240044497);
      a = ii(a, b, c, d, words[k + 8], 6, 1873313359);
      d = ii(d, a, b, c, words[k + 15], 10, 4264355552);
      c = ii(c, d, a, b, words[k + 6], 15, 2734768916);
      b = ii(b, c, d, a, words[k + 13], 21, 1309151649);
      a = ii(a, b, c, d, words[k + 4], 6, 4149444226);
      d = ii(d, a, b, c, words[k + 11], 10, 3174756917);
      c = ii(c, d, a, b, words[k + 2], 15, 718787259);
      b = ii(b, c, d, a, words[k + 9], 21, 3951481745);
      a = addUnsigned(a, aa);
      b = addUnsigned(b, bb);
      c = addUnsigned(c, cc);
      d = addUnsigned(d, dd);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  }
  function rotl(value, shift) {
    const normalizedShift = shift & 31;
    return value << normalizedShift | value >>> 32 - normalizedShift;
  }
  function p0(value) {
    return value ^ rotl(value, 9) ^ rotl(value, 17);
  }
  function p1(value) {
    return value ^ rotl(value, 15) ^ rotl(value, 23);
  }
  function sm3(input) {
    const inputLength = input.length;
    const paddedLength = Math.ceil((inputLength + 9) / 64) * 64;
    const message = new Uint8Array(paddedLength);
    message.set(input);
    message[inputLength] = 128;
    const bitLength = BigInt(inputLength) * 8n;
    for (let i2 = 0; i2 < 8; i2++) {
      message[paddedLength - 1 - i2] = Number(bitLength >> BigInt(i2 * 8) & 0xffn);
    }
    const dataView = new DataView(message.buffer);
    const state = new Uint32Array([
      1937774191,
      1226093241,
      388252375,
      3666478592,
      2842636476,
      372324522,
      3817729613,
      2969243214
    ]);
    const words = new Uint32Array(68);
    const expandedWords = new Uint32Array(64);
    for (let block = 0; block < message.length / 64; block++) {
      const start = block * 64;
      for (let i2 = 0; i2 < 16; i2++) {
        words[i2] = dataView.getUint32(start + i2 * 4, false);
      }
      for (let i2 = 16; i2 < 68; i2++) {
        words[i2] = p1(words[i2 - 16] ^ words[i2 - 9] ^ rotl(words[i2 - 3], 15)) ^ rotl(words[i2 - 13], 7) ^ words[i2 - 6];
      }
      for (let i2 = 0; i2 < 64; i2++) {
        expandedWords[i2] = words[i2] ^ words[i2 + 4];
      }
      let a = state[0];
      let b = state[1];
      let c = state[2];
      let d = state[3];
      let e = state[4];
      let f2 = state[5];
      let g2 = state[6];
      let h2 = state[7];
      for (let i2 = 0; i2 < 64; i2++) {
        const t = i2 <= 15 ? 2043430169 : 2055708042;
        const ss1 = rotl(rotl(a, 12) + e + rotl(t, i2), 7);
        const ss2 = ss1 ^ rotl(a, 12);
        const tt1 = (i2 <= 15 ? a ^ b ^ c : a & b | a & c | b & c) + d + ss2 + expandedWords[i2];
        const tt2 = (i2 <= 15 ? e ^ f2 ^ g2 : e & f2 | ~e & g2) + h2 + ss1 + words[i2];
        d = c;
        c = rotl(b, 9);
        b = a;
        a = tt1;
        h2 = g2;
        g2 = rotl(f2, 19);
        f2 = e;
        e = p0(tt2);
      }
      state[0] = state[0] ^ a;
      state[1] = state[1] ^ b;
      state[2] = state[2] ^ c;
      state[3] = state[3] ^ d;
      state[4] = state[4] ^ e;
      state[5] = state[5] ^ f2;
      state[6] = state[6] ^ g2;
      state[7] = state[7] ^ h2;
    }
    const result = new Uint8Array(32);
    for (let i2 = 0; i2 < state.length; i2++) {
      const word = state[i2];
      result[i2 * 4] = word >>> 24;
      result[i2 * 4 + 1] = word >>> 16;
      result[i2 * 4 + 2] = word >>> 8;
      result[i2 * 4 + 3] = word;
    }
    return result;
  }
  function getCrypto() {
    const c = globalThis.crypto ?? unsafeWindow.crypto;
    if (!(c == null ? void 0 : c.subtle)) {
      throw new Error("Crypto API不可用，请检查浏览器版本是否支持该API");
    }
    return c;
  }
  function getSubtle() {
    return getCrypto().subtle;
  }
  function b64decode(b64) {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i2 = 0; i2 < len; i2++) {
      bytes[i2] = binaryString.charCodeAt(i2);
    }
    return bytes.buffer;
  }
  function b64encode(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32768;
    const chunks = [];
    for (let i2 = 0; i2 < bytes.length; i2 += chunkSize) {
      chunks.push(
        String.fromCharCode(...bytes.subarray(i2, i2 + chunkSize))
      );
    }
    return btoa(chunks.join(""));
  }
  function unhex(hex2) {
    if (hex2.length % 2 !== 0) {
      throw new Error("Invalid hex string");
    }
    const bytes = new Uint8Array(hex2.length / 2);
    for (let i2 = 0; i2 < hex2.length; i2 += 2) {
      const byte = parseInt(hex2.slice(i2, i2 + 2), 16);
      if (Number.isNaN(byte)) {
        throw new Error("Invalid hex string");
      }
      bytes[i2 / 2] = byte;
    }
    return bytes.buffer;
  }
  function hex(buffer) {
    const bytes = new Uint8Array(buffer);
    let hexString = "";
    for (let i2 = 0; i2 < bytes.length; i2++) {
      hexString += bytes[i2].toString(16).padStart(2, "0");
    }
    return hexString;
  }
  function pkcs7Pad(data, blockSize = 16) {
    const padLength = blockSize - data.length % blockSize;
    const padded = new Uint8Array(data.length + padLength);
    padded.set(data);
    padded.fill(padLength, data.length);
    return padded;
  }
  function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const array = new Uint8Array(length);
    getCrypto().getRandomValues(array);
    for (let i2 = 0; i2 < length; i2++) {
      result += chars.charAt(array[i2] % chars.length);
    }
    return result;
  }
  function toBytes(input) {
    if (typeof input === "string") {
      return new TextEncoder().encode(input);
    }
    if (input instanceof Uint8Array) {
      return new Uint8Array(input);
    }
    return new Uint8Array(input);
  }
  const hash = {
    sha256: async (input) => {
      const subtle = getSubtle();
      const digest = await subtle.digest("SHA-256", toBytes(input));
      return hex(digest);
    },
    sha256bytes: async (input) => {
      const subtle = getSubtle();
      return subtle.digest("SHA-256", toBytes(input));
    },
    sha512: async (input) => {
      const subtle = getSubtle();
      const digest = await subtle.digest("SHA-512", toBytes(input));
      return hex(digest);
    },
    sha512bytes: async (input) => {
      const subtle = getSubtle();
      return subtle.digest("SHA-512", toBytes(input));
    },
    md5: async (input) => md5(
      typeof input === "string" ? input : toBytes(input).buffer
    ),
    md5bytes: async (input) => unhex(md5(
      typeof input === "string" ? input : toBytes(input).buffer
    )),
    sm3: async (input) => hex(sm3(toBytes(input)).buffer),
    sm3bytes: async (input) => sm3(toBytes(input)).buffer
  };
  const WIRE_VARINT = 0;
  const WIRE_BYTES = 2;
  const WIRE_FIXED32 = 5;
  class ProtobufWriter {
    constructor() {
      __publicField(this, "buf", []);
    }
    writeVarint(value) {
      let v = value >>> 0;
      while (v >= 128) {
        this.buf.push(v & 127 | 128);
        v >>>= 7;
      }
      this.buf.push(v & 127);
      return this;
    }
    writeKey(fieldNumber, wireType) {
      return this.writeVarint(fieldNumber << 3 | wireType);
    }
    varint(fieldNumber, value) {
      return this.writeKey(fieldNumber, WIRE_VARINT).writeVarint(value);
    }
    fixed32(fieldNumber, value) {
      this.writeKey(fieldNumber, WIRE_FIXED32);
      const v = value >>> 0;
      this.buf.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255);
      return this;
    }
    bytes(fieldNumber, data) {
      this.writeKey(fieldNumber, WIRE_BYTES).writeVarint(data.length);
      for (let i2 = 0; i2 < data.length; i2++) {
        this.buf.push(data[i2] & 255);
      }
      return this;
    }
    string(fieldNumber, value) {
      return this.bytes(fieldNumber, new TextEncoder().encode(value));
    }
    message(fieldNumber, build) {
      const sub = new ProtobufWriter();
      build(sub);
      return this.bytes(fieldNumber, sub.toBytes());
    }
    toBytes() {
      return Uint8Array.from(this.buf);
    }
  }
  const ROUNDS$1 = 72;
  const MASK64$1 = 0xffffffffffffffffn;
  const Z4 = 0x3dc94c3a046d678bn;
  function getBit(value, position) {
    return value >> BigInt(position) & 1n;
  }
  function rotateLeft64(v, n) {
    return (v << n | v >> 64n - n) & MASK64$1;
  }
  function rotateRight64(v, n) {
    return (v << 64n - n | v >> n) & MASK64$1;
  }
  function keyExpansion(key) {
    const k = [key[0] & MASK64$1, key[1] & MASK64$1, key[2] & MASK64$1, key[3] & MASK64$1];
    for (let i2 = 4; i2 < ROUNDS$1; i2++) {
      let tmp = rotateRight64(k[i2 - 1], 3n);
      tmp ^= k[i2 - 3];
      tmp ^= rotateRight64(tmp, 1n);
      k.push((~k[i2 - 4] ^ tmp ^ getBit(Z4, (i2 - 4) % 62) ^ 3n) & MASK64$1);
    }
    return k;
  }
  function simonEncrypt(plaintext, key) {
    const k = keyExpansion(key);
    let x = plaintext[0] & MASK64$1;
    let y = plaintext[1] & MASK64$1;
    for (let i2 = 0; i2 < ROUNDS$1; i2++) {
      const tmp = y;
      const f2 = rotateLeft64(y, 1n) & rotateLeft64(y, 8n);
      y = (x ^ f2 ^ rotateLeft64(y, 2n) ^ k[i2]) & MASK64$1;
      x = tmp;
    }
    return [x, y];
  }
  const LOW_RAND = new Uint8Array([242, 129]);
  const HIGH_RAND = new Uint8Array([97, 111]);
  const XOR_PREFIX = new Uint8Array([242, 247, 252, 255, 242, 247, 252, 255]);
  function sm3Prefix6(data) {
    return sm3(data).slice(0, 6);
  }
  function decodeStub(xssStub) {
    const bytes = new Uint8Array(16);
    if (xssStub.length >= 32) {
      for (let i2 = 0; i2 < 16; i2++) {
        bytes[i2] = parseInt(xssStub.slice(i2 * 2, i2 * 2 + 2), 16) & 255;
      }
    }
    return bytes;
  }
  function buildProtobuf(query, xssStub, timestamp, config) {
    const params = new URLSearchParams(query);
    const deviceId = params.get("device_id") ?? "";
    const versionName = params.get("version_name") ?? "";
    const bodyHash = sm3Prefix6(xssStub === "" ? new Uint8Array(16) : decodeStub(xssStub));
    const queryHash = sm3Prefix6(
      query === "" ? new Uint8Array(16) : new TextEncoder().encode(query)
    );
    const rand = getCrypto().getRandomValues(new Uint32Array(1))[0] % 2147483647;
    return new ProtobufWriter().varint(1, 538970409 * 2).varint(2, 2).varint(3, rand).string(4, config.aid).string(5, deviceId).string(6, config.licenseId).string(7, versionName).string(8, config.sdkVersion).varint(9, config.sdkVersionInt).bytes(10, new Uint8Array(8)).varint(11, 0).varint(12, timestamp * 2).bytes(13, bodyHash).bytes(14, queryHash).message(15, (sub) => {
      sub.varint(1, 1).varint(2, 1).varint(3, 1).varint(7, 3348294860);
    }).string(16, "").string(20, "none").varint(21, config.callType).message(23, (sub) => {
      sub.string(1, "NX551J").varint(2, 8196).varint(4, 2162219008);
    }).varint(25, 2).toBytes();
  }
  async function getArgus(query, xssStub, timestamp, config) {
    const { signKey } = config;
    if (signKey.length !== 32) {
      throw new Error(`Sign key must be 32 bytes, got ${signKey.length}`);
    }
    const protobuf = pkcs7Pad(buildProtobuf(query, xssStub, timestamp, config), 16);
    const sm3Input = new Uint8Array(signKey.length * 2 + LOW_RAND.length + HIGH_RAND.length);
    sm3Input.set(signKey, 0);
    sm3Input.set(LOW_RAND, signKey.length);
    sm3Input.set(HIGH_RAND, signKey.length + LOW_RAND.length);
    sm3Input.set(signKey, signKey.length + LOW_RAND.length + HIGH_RAND.length);
    const sm3Output = sm3(sm3Input);
    const keyView = new DataView(sm3Output.buffer, sm3Output.byteOffset, sm3Output.byteLength);
    const simonKey = [
      keyView.getBigUint64(0, true),
      keyView.getBigUint64(8, true),
      keyView.getBigUint64(16, true),
      keyView.getBigUint64(24, true)
    ];
    const encrypted = new Uint8Array(protobuf.length);
    const pbView = new DataView(protobuf.buffer, protobuf.byteOffset, protobuf.byteLength);
    const encView = new DataView(encrypted.buffer);
    for (let offset = 0; offset < protobuf.length; offset += 16) {
      const [low, high] = simonEncrypt(
        [pbView.getBigUint64(offset, true), pbView.getBigUint64(offset + 8, true)],
        simonKey
      );
      encView.setBigUint64(offset, low, true);
      encView.setBigUint64(offset + 8, high, true);
    }
    const data = new Uint8Array(XOR_PREFIX.length + encrypted.length);
    data.set(XOR_PREFIX);
    data.set(encrypted, XOR_PREFIX.length);
    for (let i2 = XOR_PREFIX.length; i2 < data.length; i2++) {
      data[i2] ^= data[i2 % 8];
    }
    data.reverse();
    const header = new Uint8Array([166, 110, 173, 159, 119, 1, 208, 12, 24]);
    const plaintext = new Uint8Array(header.length + data.length + HIGH_RAND.length);
    plaintext.set(header);
    plaintext.set(data, header.length);
    plaintext.set(HIGH_RAND, header.length + data.length);
    const subtle = getSubtle();
    const aesKey = await subtle.importKey(
      "raw",
      await hash.md5bytes(signKey.slice(0, 16)),
      { name: "AES-CBC" },
      false,
      ["encrypt"]
    );
    const iv = await hash.md5bytes(signKey.slice(16));
    const ciphertext = new Uint8Array(
      await subtle.encrypt({ name: "AES-CBC", iv }, aesKey, plaintext)
    );
    const result = new Uint8Array(LOW_RAND.length + ciphertext.length);
    result.set(LOW_RAND);
    result.set(ciphertext, LOW_RAND.length);
    return b64encode(result.buffer);
  }
  const ROUNDS = 34;
  const MASK64 = 0xffffffffffffffffn;
  const WORD_SIZE = 64n;
  const ALPHA = 8n;
  const BETA = 3n;
  function readUint64LE(view, offset) {
    return view.getBigUint64(offset, true);
  }
  function keySchedule(key) {
    const view = new DataView(key.buffer, key.byteOffset, key.byteLength);
    const ks = [readUint64LE(view, 0) & MASK64];
    const numWords = key.length * 8 / Number(WORD_SIZE);
    const ls = [];
    for (let i2 = 1; i2 < numWords; i2++) {
      ls.push(readUint64LE(view, i2 * 8) & MASK64);
    }
    for (let x = 0; x < ROUNDS - 1; x++) {
      const rsX = (ls[x] << WORD_SIZE - ALPHA) + (ls[x] >> ALPHA) & MASK64;
      const addSxy = rsX + ks[x] & MASK64;
      const newX = BigInt(x) ^ addSxy;
      const lsY = (ks[x] >> WORD_SIZE - BETA) + (ks[x] << BETA) & MASK64;
      ls.push(newX);
      ks.push(newX ^ lsY);
    }
    return ks;
  }
  function encryptBlock(ks, block, out, outOffset) {
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    let y = readUint64LE(view, 0);
    let x = readUint64LE(view, 8);
    for (const k of ks) {
      const rsX = (x << WORD_SIZE - ALPHA) + (x >> ALPHA) & MASK64;
      const addSxy = rsX + y & MASK64;
      x = k ^ addSxy;
      const lsY = (y >> WORD_SIZE - BETA) + (y << BETA) & MASK64;
      y = x ^ lsY;
    }
    const outView = new DataView(out.buffer, out.byteOffset, out.byteLength);
    outView.setBigUint64(outOffset, y & MASK64, true);
    outView.setBigUint64(outOffset + 8, x & MASK64, true);
  }
  function speckEncrypt(key, plaintext) {
    if (key.length !== 32) {
      throw new Error(`Speck key must be 32 bytes, got ${key.length}`);
    }
    const padded = pkcs7Pad(plaintext, 16);
    const ks = keySchedule(key);
    const out = new Uint8Array(padded.length);
    for (let i2 = 0; i2 < padded.length; i2 += 16) {
      encryptBlock(ks, padded.subarray(i2, i2 + 16), out, i2);
    }
    return out;
  }
  async function generateLadonKey(randomBytes, aid) {
    const aidBytes = new TextEncoder().encode(aid);
    const input = new Uint8Array(randomBytes.length + aidBytes.length);
    input.set(randomBytes);
    input.set(aidBytes, randomBytes.length);
    const hex2 = await hash.md5(input);
    return new TextEncoder().encode(hex2);
  }
  async function getLadon(timestamp, config) {
    const randomBytes = getCrypto().getRandomValues(new Uint8Array(4));
    const plaintext = new TextEncoder().encode(
      `${timestamp}-${config.licenseId}-${config.aid}`
    );
    const key = await generateLadonKey(randomBytes, config.aid);
    const encrypted = speckEncrypt(key, plaintext);
    const result = new Uint8Array(randomBytes.length + encrypted.length);
    result.set(randomBytes);
    result.set(encrypted, randomBytes.length);
    return b64encode(result.buffer);
  }
  const defaultUnidbgConfig = {
    signKey: new Uint8Array(
      unhex("ac1adaae95a7af94a5114ab3b3a97dd80050aa0a39314c40528caec95256c28c")
    ),
    aid: "1967",
    licenseId: "1611921764",
    sdkVersion: "v04.04.05-ov-android",
    sdkVersionInt: 134744640,
    callType: 738
  };
  async function generateHeaders(rawQuery, xssStub = "", timestamp = Math.floor(Date.now() / 1e3), config = defaultUnidbgConfig) {
    const [argus, ladon] = await Promise.all([
      getArgus(rawQuery, xssStub, timestamp, config),
      getLadon(timestamp, config)
    ]);
    return {
      "x-argus": argus,
      "x-ladon": ladon,
      "x-khronos": String(timestamp)
    };
  }
  async function signRequest(url, body, config = defaultUnidbgConfig) {
    const rawQuery = new URL(url).search.replace(/^\?/, "");
    const hasBody = typeof body === "string" ? body.length > 0 : ((body == null ? void 0 : body.byteLength) ?? 0) > 0;
    const xssStub = hasBody ? await hash.md5(body) : "";
    const now = Date.now();
    const headers = await generateHeaders(
      rawQuery,
      xssStub,
      Math.floor(now / 1e3),
      config
    );
    headers["x-ss-req-ticket"] = String(now);
    if (hasBody) {
      headers["X-SS-STUB"] = xssStub;
    }
    return headers;
  }
  const appBaseUrl = "https://reading.snssdk.com/reading";
  const redcandleBaseUrl = "https://api5-sinfonlinec.jxbhmy.com/reading";
  const webBaseUrl = "https://fanqienovel.com/reading";
  const appUserAgent = "com.dragon.read";
  function buildAppQuery(extra) {
    const c = _config.currentConfig;
    return new URLSearchParams({
      iid: c.install_id,
      device_id: c.device_id,
      ac: "wifi",
      channel: "43536163a",
      aid: "1967",
      app_name: "novelapp",
      version_code: "70132",
      version_name: "7.0.1.32",
      device_platform: "android",
      os: "android",
      ssmix: "a",
      os_version: "10",
      device_type: c.device_type || "P30",
      device_brand: c.device_brand || "realme",
      update_version_code: "70132",
      manifest_version_code: "70132",
      ...extra
    });
  }
  async function webGet(path, query, credentials2 = "omit") {
    const url = `${webBaseUrl}${path}?${buildAppQuery(query).toString()}`;
    const signed = await signRequest(url);
    const res = await fetch$1(url, { headers: signed, credentials: credentials2 });
    if (!res.ok) {
      throw new Error(`请求失败(${res.status})`);
    }
    return res.json();
  }
  function isUsable(res) {
    if (!res || res.status !== 200) return false;
    try {
      const j = res.json();
      return !j || j.code === void 0 || j.code === 0;
    } catch {
      return false;
    }
  }
  async function requestApp(path, query, headers) {
    const url = `${appBaseUrl}${path}?${buildAppQuery(query).toString()}`;
    const signed = await signRequest(url);
    return apiFetch(url, {
      method: "GET",
      headers: { ...signed, "User-Agent": appUserAgent, ...headers }
    });
  }
  async function requestRedcandle(path, query, headers) {
    const url = `${redcandleBaseUrl}${path}?${buildAppQuery(query).toString()}`;
    return apiFetch(url, {
      method: "GET",
      headers: { "User-Agent": appUserAgent, ...headers }
    });
  }
  async function appGet(path, query, headers) {
    if (settings$1.apiPreference === "redcandle") {
      try {
        const res = await requestRedcandle(path, query, headers);
        if (isUsable(res)) return res;
        console.warn(`[fqa:api] 红烛接口数据不全，回落到番茄 APP: ${path}`);
      } catch (e) {
        console.warn(`[fqa:api] 红烛接口请求失败，回落到番茄 APP: ${path}`, e);
      }
    }
    return requestApp(path, query, headers);
  }
  async function appPost(path, body, query, headers) {
    const url = `${appBaseUrl}${path}?${buildAppQuery(query).toString()}`;
    const signed = await signRequest(url, body);
    console.log("---start--- APP POST ", url);
    const res = await apiFetch(url, {
      method: "POST",
      headers: {
        ...signed,
        "User-Agent": appUserAgent,
        "Content-Type": "application/json; charset=utf-8",
        ...headers
      },
      body
    });
    console.log("---complete--- APP POST ", url, res);
    return res;
  }
  async function gzip(data) {
    if (typeof data === "string") {
      data = new TextEncoder().encode(data).buffer;
    }
    const encoder = new CompressionStream("gzip");
    const stream = new Blob([data]).stream().pipeThrough(encoder);
    const compressed = new Response(stream).arrayBuffer();
    return compressed;
  }
  async function gunzip(data) {
    const decoder = new DecompressionStream("gzip");
    const stream = new Blob([data]).stream().pipeThrough(decoder);
    const decompressed = new Response(stream).arrayBuffer();
    return decompressed;
  }
  async function decryptChapter(encrypted, rawData, config = defaultConfig) {
    var _a;
    if (!encrypted) {
      throw new Error("Invalid encrypted chapter");
    }
    const buf = b64decode(encrypted);
    const iv = buf.slice(0, 16);
    const data = buf.slice(16);
    const key = (_a = config.key_info) == null ? void 0 : _a.key;
    if (!key) {
      throw new Error("Missing decrypt key");
    }
    const subtle = getSubtle();
    const cryptoKey = await subtle.importKey(
      "raw",
      key,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );
    return subtle.decrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      data
    ).then(async (decrypted) => {
      if (rawData && (rawData == null ? void 0 : rawData.compress_status) === 1) {
        decrypted = await gunzip(decrypted);
      }
      const decoder = new TextDecoder();
      const plain = decoder.decode(decrypted);
      if (plain.trim().startsWith("<")) {
        return plain;
      }
      try {
        return JSON.parse(plain);
      } catch (e) {
        console.warn("Invalid chapter content: ", plain, e);
        return void 0;
      }
    });
  }
  async function decryptComicImage(image, key) {
    const subtle = getSubtle();
    const cryptoKey = await subtle.importKey(
      "raw",
      unhex(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const iv = image.slice(0, 12);
    const data = image.slice(12);
    return await subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      data
    );
  }
  function reverseHex(value) {
    const be = BigInt(value).toString(16).padStart(32, "0");
    let result = "";
    for (let i2 = be.length; i2 > 0; i2 -= 2) result += be.slice(i2 - 2, i2);
    return result;
  }
  async function encryptKeyinfoBody(config) {
    const deviceId = config.device_id;
    const iv = new TextEncoder().encode(randomString(16));
    const data = new Uint8Array(unhex(reverseHex(deviceId))).slice(0, 8);
    console.log(data);
    const subtle = getSubtle();
    const k = await subtle.importKey(
      "raw",
      shared_key,
      { name: "AES-CBC" },
      false,
      ["encrypt"]
    );
    const encrypted = await subtle.encrypt(
      { name: "AES-CBC", iv },
      k,
      data
    );
    const final = new Uint8Array(iv.length + encrypted.byteLength);
    console.log(final);
    final.set(iv, 0);
    final.set(new Uint8Array(encrypted), iv.length);
    return JSON.stringify({
      content: b64encode(final.buffer)
    });
  }
  async function decryptKeyinfoResponse(encrypted) {
    const buf = b64decode(encrypted);
    const iv = buf.slice(0, 16);
    const data = buf.slice(16);
    const subtle = getSubtle();
    const k = await subtle.importKey(
      "raw",
      shared_key,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );
    return subtle.decrypt(
      { name: "AES-CBC", iv },
      k,
      data
    );
  }
  async function refreshKeyinfo() {
    var _a, _b, _c;
    const b = await encryptKeyinfoBody(_config.currentConfig);
    const res = await appPost("/crypt/registerkey", b);
    const j = res.json();
    const ek = (_a = j == null ? void 0 : j.data) == null ? void 0 : _a.key;
    if (!ek) {
      throw new Error(`Failed to get key info: ${res.responseText}`);
    }
    const key = await decryptKeyinfoResponse(ek);
    const keyinfo = {
      key,
      keyver: (_b = j == null ? void 0 : j.data) == null ? void 0 : _b.keyver
    };
    console.log("Refreshed key info:", keyinfo);
    _config.currentConfig.key_info = keyinfo;
    write("keyinfo", {
      key: b64encode(key),
      keyver: (_c = j == null ? void 0 : j.data) == null ? void 0 : _c.keyver
    });
  }
  let refreshInflight = null;
  function refreshKey() {
    if (!refreshInflight) {
      refreshInflight = refreshKeyinfo().finally(() => {
        refreshInflight = null;
      });
    }
    return refreshInflight;
  }
  async function ensureKeyinfo(expectedKeyVersion) {
    const keyinfo = _config.currentConfig.key_info;
    const cachedKeyInfo = read("keyinfo");
    console.log("cached key info: ", cachedKeyInfo);
    if (cachedKeyInfo) {
      const cki = {
        key: b64decode(cachedKeyInfo.key),
        keyver: cachedKeyInfo.keyver
      };
      if (typeof expectedKeyVersion === "undefined" || cki.keyver === expectedKeyVersion) {
        _config.currentConfig.key_info = cki;
        return;
      }
    }
    if (!keyinfo) {
      return await refreshKey();
    }
    if ((keyinfo == null ? void 0 : keyinfo.keyver) !== expectedKeyVersion) {
      return await refreshKey();
    }
  }
  async function getChapter(itemId, _retry = 0) {
    var _a, _b;
    if (typeof _retry === "undefined") _retry = 0;
    if (_retry > 5) {
      throw new Error(`Failed to get chapter: ${itemId}`);
    }
    if (!_config.currentConfig.key_info) {
      await ensureKeyinfo();
    }
    const res = await appGet("/reader/full/v", { item_id: itemId, req_type: "1" });
    const j = (_a = res.json()) == null ? void 0 : _a.data;
    if (!j) {
      console.warn("Failed to get chapter: ", itemId, ", response: ", res.responseText);
      return await getChapter(itemId, _retry + 1);
    }
    if ((j == null ? void 0 : j.content) === "Invalid" || (j == null ? void 0 : j.key_version) !== ((_b = _config.currentConfig.key_info) == null ? void 0 : _b.keyver)) {
      console.warn("Key reg expired, regster again and retrying...");
      if ((j == null ? void 0 : j.content) === "Invalid") {
        await refreshKey();
      } else {
        await ensureKeyinfo(parseInt(j == null ? void 0 : j.key_version));
      }
      return await getChapter(itemId, _retry + 1);
    }
    j.content = await decryptChapter(j == null ? void 0 : j.content, j, _config.currentConfig);
    return j;
  }
  async function getChapters(itemIds, bookId = "0", _retry = 0) {
    var _a, _b;
    if (itemIds.length === 0) return {};
    if (!_config.currentConfig.key_info) {
      await ensureKeyinfo();
    }
    const res = await appGet("/reader/batch_full/v", {
      item_ids: itemIds.join(","),
      book_id: bookId,
      novel_text_type: "1",
      req_type: "1"
    });
    const raw = (_a = res.json()) == null ? void 0 : _a.data;
    const entries = raw && typeof raw === "object" ? Array.isArray(raw) ? raw.map((it) => {
      var _a2;
      return [String((it == null ? void 0 : it.item_id) ?? ((_a2 = it == null ? void 0 : it.novel_data) == null ? void 0 : _a2.item_id) ?? ""), it];
    }) : Object.entries(raw) : [];
    if (entries.length === 0) {
      throw new Error(`Failed to batch get chapters: ${res.responseText}`);
    }
    const localKeyver = (_b = _config.currentConfig.key_info) == null ? void 0 : _b.keyver;
    const expired = entries.filter(
      ([, item]) => (item == null ? void 0 : item.code) === 0 || (item == null ? void 0 : item.code) === void 0 ? (item == null ? void 0 : item.content) === "Invalid" || (item == null ? void 0 : item.key_version) !== void 0 && Number(item.key_version) !== localKeyver : false
    );
    if (expired.length > 0 && _retry < 2) {
      const [, sample] = expired[0];
      console.warn(
        `[fqa:api] 批量正文密钥失效（${expired.length}/${entries.length} 章），重新注册后重试。本地 keyver=${localKeyver}，服务端=${sample == null ? void 0 : sample.key_version}`
      );
      await refreshKey();
      await sleep(800);
      return await getChapters(itemIds, bookId, _retry + 1);
    }
    const results = {};
    for (const [id, item] of entries) {
      if (!id) continue;
      if ((item == null ? void 0 : item.code) !== void 0 && item.code !== 0) {
        results[id] = { ...item, item_id: id, error: `code ${item.code}` };
        continue;
      }
      if (!(item == null ? void 0 : item.content) || item.content === "Invalid") {
        results[id] = { ...item, item_id: id, error: "Invalid content" };
        continue;
      }
      try {
        results[id] = {
          ...item,
          item_id: id,
          novel_data: item.novel_data,
          content: await decryptChapter(item.content, item, _config.currentConfig)
        };
      } catch (e) {
        results[id] = { ...item, item_id: id, error: String(e) };
      }
    }
    return results;
  }
  async function getCatalogRaw(bookId) {
    var _a;
    const response = await appGet("/bookapi/directory/all_items/v", { book_id: bookId });
    const j = response.json();
    const items = (_a = j == null ? void 0 : j.data) == null ? void 0 : _a.item_data_list;
    if ((j == null ? void 0 : j.code) !== 0 || !Array.isArray(items) || items.length === 0) {
      throw new Error("Empty catalog");
    }
    return [items, items.map((it) => String(it.item_id))];
  }
  async function webCatalog(bookId) {
    const url = `https://fanqienovel.com/api/reader/directory/detail?bookId=${bookId}`;
    const response = await apiFetch(url);
    const rj = response.json();
    const d = rj.data;
    const allItems = d.allItemIds;
    const volmap = {};
    const vname = d.volumeNameList;
    for (let i2 = 0; i2 < vname.length; i2++) {
      const volumeName = vname[i2];
      if (volumeName !== void 0) {
        volmap[volumeName] = d.chapterListWithVolume[i2];
      }
    }
    return [volmap, allItems];
  }
  async function getCatalog(bookId) {
    let catalogRaw = null;
    let allItemIds = null;

    // 1. Try App API
    try {
      const r = await getCatalogRaw(bookId);
      if (r && Array.isArray(r[0]) && r[0].length > 0) {
        catalogRaw = r[0];
        allItemIds = r[1];
      }
    } catch (err) {
      console.warn(`[getCatalog] App API directory failed for ${bookId}:`, err);
    }

    // 2. Try Web API if App API failed or returned empty
    if (!catalogRaw || !allItemIds || catalogRaw.length === 0) {
      try {
        const rw = await webCatalog(bookId);
        if (rw && rw[0] && rw[1]) {
          const volmap = rw[0];
          allItemIds = Array.isArray(rw[1]) ? rw[1].map((id: any) => String(id)) : [];
          catalogRaw = [];
          
          if (typeof volmap === 'object' && volmap !== null) {
            for (const [volName, chapterArr] of Object.entries(volmap)) {
              if (Array.isArray(chapterArr)) {
                for (const ch of chapterArr) {
                  catalogRaw.push({
                    volume_name: volName,
                    item_id: String(ch.itemId || ch.item_id || ch.id || ''),
                    title: ch.title || 'Chương không tên',
                    first_pass_time: ch.firstPassTime || ch.first_pass_time || 0,
                    chapter_word_number: ch.wordCount || ch.chapter_word_number || 0
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[getCatalog] Web API directory failed for ${bookId}:`, err);
      }
    }

    // 3. Fallback: Parse web page HTML window.__INITIAL_STATE__
    if (!catalogRaw || catalogRaw.length === 0) {
      try {
        console.log(`[getCatalog] Trying HTML fallback for book ${bookId}...`);
        const webRes = await fetch(`https://fanqienovel.com/page/${bookId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        const html = await webRes.text();
        const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s);
        if (match) {
          const pageData = JSON.parse(match[1])?.page;
          const chapterListData = pageData?.chapterList || pageData?.chapterListWithVolume || [];
          if (Array.isArray(chapterListData) && chapterListData.length > 0) {
            catalogRaw = [];
            allItemIds = [];
            chapterListData.forEach((ch: any) => {
              const itemId = String(ch.itemId || ch.item_id || ch.id || "");
              if (itemId) {
                allItemIds.push(itemId);
                catalogRaw.push({
                  volume_name: ch.volumeName || ch.volume_name || "",
                  item_id: itemId,
                  title: ch.title || "Chương không tên",
                  first_pass_time: ch.firstPassTime || ch.first_pass_time || 0,
                  chapter_word_number: ch.wordCount || ch.chapter_word_number || 0
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn("[getCatalog] HTML fallback failed:", e);
      }
    }

    if (!catalogRaw || catalogRaw.length === 0) {
      throw new Error(`Không thể lấy danh sách chương cho truyện (ID: ${bookId}). Truyện có thể đã bị ẩn hoặc gỡ khỏi hệ thống.`);
    }

    const vmap = {};
    const chapters = [];
    catalogRaw.forEach((item) => {
      const volumeName = item.volume_name ?? "";
      const passTime = Number(item.first_pass_time || item.firstPassTime || 0);
      const chapterItem = {
        item_id: String(item.item_id || item.itemId),
        title: item.title || "Chương không tên",
        update_time: passTime ? moment(passTime * 1e3).format("YYYY-MM-DD HH:mm:ss") : "",
        char_count: item.chapter_word_number || 0,
        volume_title: volumeName
      };
      chapters.push(chapterItem);
      if (!vmap[volumeName]) {
        vmap[volumeName] = {
          title: volumeName,
          book_id: bookId,
          chapter_list: []
        };
      }
      if (vmap[volumeName]) {
        vmap[volumeName].chapter_list.push(chapterItem);
      }
    });

    return {
      book_id: bookId,
      volume_list: Object.values(vmap),
      chapter_list: chapters,
      all_item_ids: allItemIds && allItemIds.length > 0 ? allItemIds : chapters.map(c => c.item_id)
    };
  }
  function mappingCreationStatus(status) {
    switch (status) {
      case "0":
        return "完结";
      case "1":
        return "连载";
      case "4":
        return "断更";
      default:
        return "未知";
    }
  }
  function extractFanqieTags(bookData: any): string {
    if (!bookData) return "";
    const tagsSet = new Set<string>();

    // 1. Status tag (e.g. 已完结 / 连载中)
    const statusNum = String(bookData.creation_status ?? bookData.creationStatus ?? "");
    if (statusNum === "0") {
      tagsSet.add("已完结");
    } else if (statusNum === "1") {
      tagsSet.add("连载中");
    }

    // 2. category_v2 / categoryV2 (holds tags like 双男主, 穿越, 甜宠, 现代, 1v1, etc.)
    const catV2 = bookData.category_v2 || bookData.categoryV2;
    if (catV2) {
      try {
        const parsed = typeof catV2 === "string" ? JSON.parse(catV2) : catV2;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.Name && typeof item.Name === "string") {
              const trimmed = item.Name.trim();
              if (trimmed) tagsSet.add(trimmed);
            }
          }
        }
      } catch (e) {}
    }

    // 3. tags field (comma or slash separated)
    if (bookData.tags) {
      if (Array.isArray(bookData.tags)) {
        bookData.tags.forEach((t: any) => {
          if (typeof t === "string" && t.trim()) tagsSet.add(t.trim());
        });
      } else if (typeof bookData.tags === "string") {
        bookData.tags.split(/[,，、/]/).forEach((t: string) => {
          if (t.trim()) tagsSet.add(t.trim());
        });
      }
    }

    // 4. pure_category_tags
    if (typeof bookData.pure_category_tags === "string") {
      bookData.pure_category_tags.split(/[,，、/]/).forEach((t: string) => {
        if (t.trim()) tagsSet.add(t.trim());
      });
    }

    // 5. tag_list
    if (Array.isArray(bookData.tag_list)) {
      bookData.tag_list.forEach((t: any) => {
        if (typeof t === "string" && t.trim()) tagsSet.add(t.trim());
        else if (t && t.name && typeof t.name === "string" && t.name.trim()) tagsSet.add(t.name.trim());
      });
    }

    // 6. Category & sub_category
    if (typeof bookData.category === "string" && bookData.category.trim() && bookData.category !== "Tiểu thuyết") {
      tagsSet.add(bookData.category.trim());
    }
    if (typeof bookData.sub_category === "string" && bookData.sub_category.trim()) {
      tagsSet.add(bookData.sub_category.trim());
    }

    return Array.from(tagsSet).join(", ");
  }

  async function getBookInfoRaw(bookId) {
    try {
      const response = await appGet("/bookapi/detail/v", { book_id: bookId });
      const j = response.json();
      console.log("Book Info from appGet:", j?.code, j?.message);
      if (j && j.data && (j.data.book_id || j.data.book_name)) {
        return j.data;
      }
    } catch (err) {
      console.warn("appGet /bookapi/detail/v failed:", err);
    }

    // Web fallback if app API returns BOOK_REMOVE or fails
    try {
      console.log(`Trying web page fallback for bookId ${bookId}...`);
      const webRes = await fetch(`https://fanqienovel.com/page/${bookId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const html = await webRes.text();
      const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s);
      if (match) {
        const pageState = JSON.parse(match[1])?.page;
        if (pageState && (pageState.bookName || pageState.author)) {
          return {
            book_id: pageState.bookId || bookId,
            book_name: pageState.bookName,
            author: pageState.author,
            thumb_url: pageState.thumbUrl || pageState.thumbUri,
            abstract: pageState.abstract || pageState.description,
            category_v2: pageState.categoryV2,
            category: pageState.category,
            creation_status: String(pageState.creationStatus ?? ""),
            last_chapter_title: pageState.lastChapterTitle,
            word_number: String(pageState.wordNumber || "0"),
            chapter_count: Number(pageState.chapterTotal || 0)
          };
        }
      }
    } catch (e) {
      console.warn("Web fallback error:", e);
    }

    return null;
  }

  async function getBookInfo(bookId) {
    const bookInfo = await getBookInfoRaw(bookId);
    if (!bookInfo) {
      throw new Error("Không tìm thấy thông tin truyện hoặc truyện đã bị gỡ");
    }

    const tags = extractFanqieTags(bookInfo);
    let updateTime = "";
    if (bookInfo.last_chapter_first_pass_time) {
      try {
        updateTime = moment(bookInfo.last_chapter_first_pass_time * 1e3).format("YYYY-MM-DD HH:mm:ss");
      } catch (e) {}
    }

    return {
      book_id: bookInfo.book_id || bookId,
      title: bookInfo.book_name || bookInfo.original_book_name || "Truyện Fanqie",
      author: bookInfo.author || "Tác giả",
      cover_url: bookInfo.thumb_url || bookInfo.detail_page_thumb_url || "",
      summary: formatAbstract(bookInfo.book_abstract_v2 || bookInfo.abstract || ""),
      tags: tags || bookInfo.category || "Tiểu thuyết",
      category: bookInfo.category || (tags.split(",")[0]?.trim() || "Tiểu thuyết"),
      score: bookInfo.score || "9.0",
      chapter_count: Number(bookInfo.chapter_count || bookInfo.serial_count || bookInfo.content_chapter_number || 0),
      last_chapter_title: bookInfo.last_chapter_title || "",
      update_time: updateTime,
      creation_status: bookInfo.creation_status,
      status: mappingCreationStatus(bookInfo.creation_status)
    };
  }
  async function getBookInfoAndCatalog(book) {
    if (typeof book !== "string") {
      book = book.book_id;
    }
    const bookInfo = await getBookInfo(book);
    if (!bookInfo) {
      throw new Error("Book not found");
    }
    const catalog = await getCatalog(bookInfo.book_id);
    console.log("Catalog:", catalog);
    bookInfo.volume_list = catalog.volume_list;
    bookInfo.chapter_list = catalog.chapter_list;
    return bookInfo;
  }

/**
 * Parses user input to extract clean bookId
 */
export function parseBookId(input) {
  if (!input) return "";
  const trimmed = String(input).trim();
  
  // 1. Pure digits (15 to 22 digits)
  if (/^\d{15,22}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. /page/123456789... or /reader/123456789...
  const pageMatch = trimmed.match(/page\/(\d{15,22})/i) || trimmed.match(/reader\/(\d{15,22})/i);
  if (pageMatch) return pageMatch[1];

  // 3. book_id=123456789... or bookId=123456789...
  const bookIdMatch = trimmed.match(/book_?id=(\d{15,22})/i);
  if (bookIdMatch) return bookIdMatch[1];

  // 4. Match any sequence of 15 to 22 digits anywhere in URL or share text
  const anyDigits = trimmed.match(/(\d{15,22})/);
  if (anyDigits) return anyDigits[1];

  return trimmed;
}

/**
 * Decodes all HTML entities including decimal (&#34;), hex (&#x22;), and named entities (&quot;, &amp;, &lt;, &gt;, &apos;, &nbsp;)
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        const code = parseInt(dec, 10);
        return !isNaN(code) ? String.fromCharCode(code) : _;
      } catch (e) {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
      try {
        const code = parseInt(hex, 16);
        return !isNaN(code) ? String.fromCharCode(code) : _;
      } catch (e) {
        return _;
      }
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

/**
 * Normalizes and formats novel abstracts / synopses so paragraphs are cleanly separated
 * instead of sticking together into a single wall of text.
 */
export function formatAbstract(raw: string | undefined | null): string {
  if (!raw) return "";
  let s = decodeHtmlEntities(String(raw));

  // 1. Convert HTML line breaks to newlines
  s = s.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/p>/gi, '\n\n')
       .replace(/<[^>]+>/g, '');

  // 2. Standardize carriage returns
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Convert multi-space / full-width em-space indentations into paragraph breaks
  // Fanqie and other Chinese sources often encode paragraph breaks as 2+ spaces or \u3000 (em-space)
  s = s.replace(/[\t\u3000\u00A0 ]{2,}/g, '\n\n');

  // 4. Handle Chinese punctuation endings (。！？】”」』) followed by space/indent
  s = s.replace(/([。！？】”」』])[\t\u3000\u00A0 ]+(?=[^\s])/g, '$1\n\n');

  // 5. Clean up each line and eliminate redundant blanks
  const lines = s.split('\n')
    .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
    .filter(Boolean);

  return lines.join('\n\n');
}

export function formatChapterText(htmlOrText, title) {
  if (!htmlOrText) return "";
  let text = String(htmlOrText);

  if (text.includes('<p') || text.includes('<article')) {
    const paragraphs = [];
    const pMatches = text.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches && pMatches.length > 0) {
      for (const p of pMatches) {
        const cleanP = decodeHtmlEntities(
          p
            .replace(/<[^>]+>/g, '')
            .replace(/^[\s\u3000\u00A0]+/, '')
            .replace(/[\s\u3000\u00A0]+$/, '')
        );
        if (cleanP) {
          paragraphs.push(cleanP);
        }
      }
      text = paragraphs.join('\n');
    } else {
      text = decodeHtmlEntities(
        text
          .replace(/<[^>]+>/g, '')
      )
        .split('\n')
        .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
        .filter(Boolean)
        .join('\n');
    }
  } else {
    text = decodeHtmlEntities(text);
    const lines = text
      .split('\n')
      .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
      .filter(Boolean);
    text = lines.join('\n');
  }

  const cleanTitle = title ? decodeHtmlEntities(String(title)).replace(/^[\s\u3000\u00A0]+/, '').trim() : '';

  if (cleanTitle) {
    return cleanTitle + "\n" + text;
  }
  return text;
}

export async function searchBooks(query, count = 10) {
  try {
    const res = await appGet("/bookapi/search/tab/v", {
      query: String(query).trim(),
      tab_type: "0",
      offset: "0",
      count: String(count)
    });
    const tabs = res?.data?.search_tabs ?? [];
    const books = [];

    for (const tab of tabs) {
      const list = tab?.data ?? [];
      for (const item of list) {
        const b = item?.book_data?.[0] || item?.book_info || item?.book || item?.data || item;
        if (b && (b.book_id || b.bookId)) {
          const bookId = String(b.book_id || b.bookId);
          const chapterCount = Number(
            b.serial_count ||
            b.content_chapter_number ||
            b.chapter_count ||
            b.chapter_number ||
            b.sub_count ||
            b.item_count ||
            b.total_chapter_count ||
            0
          );
          books.push({
            book_id: bookId,
            book_name: b.book_name || b.bookName || b.title || "Chưa có tên",
            author: b.author || "Tác giả",
            thumb_url: b.thumb_url || b.detail_page_thumb_url || b.thumbUri || "",
            score: b.score || "9.0",
            category: b.category || "Tiểu thuyết",
            abstract: formatAbstract(b.abstract || b.book_abstract_v2 || b.summary || ""),
            word_number: String(b.word_number || b.wordCount || "0"),
            chapter_count: chapterCount,
            last_chapter_title: b.last_chapter_title || b.lastChapterTitle || "",
            creation_status: String(b.creation_status) === "0" ? "已完结 (Hoàn thành)" : "连载中 (Đang ra)"
          });
        }
      }
    }
    return books;
  } catch (err) {
    console.warn("Search error:", err);
    return [];
  }
}

export function parseFanqieCoverFromUrl(rawUrl: string): { folder: string; hash: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const decoded = decodeURIComponent(rawUrl);
  // Match folder like novel-pic, novel-images, tos-cn-i-*, novel-static
  const match = decoded.match(/(novel-pic|novel-images|tos-cn-i-[a-z0-9_-]+|novel-static)\/([a-f0-9]{32})/i);
  if (match) {
    return { folder: match[1], hash: match[2].toLowerCase() };
  }
  // Match standalone 32-hex hash
  const hashMatch = decoded.match(/([a-f0-9]{32})/i);
  if (hashMatch) {
    return { folder: 'novel-pic', hash: hashMatch[1].toLowerCase() };
  }
  return null;
}

export function buildHdCoverUrls(folder: string, hash: string) {
  return {
    originalUrl: `https://p3-novel.byteimg.com/origin/${folder}/${hash}`,
    hd2kUrl: `https://p3-novel.byteimg.com/${folder}/${hash}~tplv-resize:1600:0.image`,
    hd1200Url: `https://p3-novel.byteimg.com/${folder}/${hash}~tplv-resize:1200:0.image`,
    pngUrl: `https://p3-novel.byteimg.com/origin/${folder}/${hash}.png`
  };
}

export async function extractFanqieHdCover(input: string, bookNameHint?: string, authorHint?: string) {
  if (!input || typeof input !== 'string') {
    throw new Error('Vui lòng cung cấp link ảnh bìa, ID truyện hoặc link truyện Fanqie');
  }

  const trimmed = input.trim();
  let bookName = bookNameHint || '';
  let author = authorHint || '';

  // Case 1: Direct cover URL or hash
  let parsed = parseFanqieCoverFromUrl(trimmed);

  // Case 2: If input is a book ID or link to book page
  if (!parsed) {
    const bookId = parseBookId(trimmed);
    if (bookId) {
      const info = await getBookInfo(bookId);
      if (info && info.cover_url) {
        parsed = parseFanqieCoverFromUrl(info.cover_url);
        bookName = info.title || bookName;
        author = info.author || author;
      }
    }
  }

  if (!parsed) {
    throw new Error('Không tìm thấy mã băm ảnh bìa hợp lệ của Fanqie');
  }

  const urls = buildHdCoverUrls(parsed.folder, parsed.hash);

  return {
    success: true,
    hash: parsed.hash,
    folder: parsed.folder,
    bookName,
    author,
    ...urls
  };
}

export {
  getBookInfo,
  getCatalog,
  getChapter,
  getChapters
};
