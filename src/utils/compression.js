import zlib from 'zlib';
import { promisify } from 'util';

// Promisify compression methods
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

/**
 * Compress data using gzip
 * @param {Buffer|string} data - Data to compress
 * @returns {Promise<Buffer>} Compressed data
 */
export async function compress(data) {
  try {
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    return await gzip(input);
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

/**
 * Decompress gzipped data
 * @param {Buffer} compressedData - Compressed data
 * @returns {Promise<Buffer>} Decompressed data
 */
export async function decompress(compressedData) {
  try {
    if (!Buffer.isBuffer(compressedData)) {
      throw new Error('Compressed data must be a Buffer');
    }
    return await gunzip(compressedData);
  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

/**
 * Compress data using deflate (smaller compression, faster)
 * @param {Buffer|string} data - Data to compress
 * @returns {Promise<Buffer>} Compressed data
 */
export async function compressDeflate(data) {
  try {
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    return await deflate(input);
  } catch (error) {
    throw new Error(`Deflate compression failed: ${error.message}`);
  }
}

/**
 * Decompress deflated data
 * @param {Buffer} compressedData - Compressed data
 * @returns {Promise<Buffer>} Decompressed data
 */
export async function decompressDeflate(compressedData) {
  try {
    if (!Buffer.isBuffer(compressedData)) {
      throw new Error('Compressed data must be a Buffer');
    }
    return await inflate(compressedData);
  } catch (error) {
    throw new Error(`Deflate decompression failed: ${error.message}`);
  }
}

/**
 * Get compression ratio
 * @param {number} originalSize - Original size in bytes
 * @param {number} compressedSize - Compressed size in bytes
 * @returns {number} Compression ratio as percentage
 */
export function getCompressionRatio(originalSize, compressedSize) {
  if (originalSize === 0) return 0;
  return ((originalSize - compressedSize) / originalSize) * 100;
}

/**
 * Check if data should be compressed based on size and content
 * @param {Buffer|string} data - Data to check
 * @param {number} minSize - Minimum size threshold (default: 10KB)
 * @returns {boolean} Whether data should be compressed
 */
export function shouldCompress(data, minSize = 10240) {
  const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
  
  // Don't compress small data
  if (size < minSize) return false;
  
  // Check if data appears to be already compressed or binary
  if (Buffer.isBuffer(data)) {
    const sample = data.slice(0, Math.min(100, data.length));
    const entropy = calculateEntropy(sample);
    
    // High entropy suggests already compressed or binary data
    if (entropy > 7.5) return false;
  }
  
  return true;
}

/**
 * Calculate entropy of data (to detect already compressed content)
 * @param {Buffer} buffer - Data buffer
 * @returns {number} Entropy value
 */
function calculateEntropy(buffer) {
  const frequencies = new Map();
  
  // Count byte frequencies
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }
  
  // Calculate entropy
  let entropy = 0;
  const length = buffer.length;
  
  for (const count of frequencies.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Compress JSON data with metadata
 * @param {object} jsonData - JSON object to compress
 * @returns {Promise<object>} Compression result with metadata
 */
export async function compressJSON(jsonData) {
  const jsonString = JSON.stringify(jsonData);
  const originalSize = Buffer.byteLength(jsonString);
  
  if (!shouldCompress(jsonString)) {
    return {
      data: Buffer.from(jsonString),
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0
    };
  }
  
  const compressed = await compress(jsonString);
  const compressedSize = compressed.length;
  const ratio = getCompressionRatio(originalSize, compressedSize);
  
  return {
    data: compressed,
    compressed: true,
    originalSize,
    compressedSize,
    compressionRatio: ratio
  };
}

/**
 * Decompress and parse JSON data
 * @param {Buffer} compressedData - Compressed data buffer
 * @param {boolean} isCompressed - Whether data is compressed
 * @returns {Promise<object>} Parsed JSON object
 */
export async function decompressJSON(compressedData, isCompressed) {
  let jsonString;
  
  if (isCompressed) {
    const decompressed = await decompress(compressedData);
    jsonString = decompressed.toString('utf8');
  } else {
    jsonString = compressedData.toString('utf8');
  }
  
  return JSON.parse(jsonString);
}