const path = require('path');

function createMultipartError(message) {
  const error = new Error(message);
  error.code = 'INVALID_MULTIPART';
  return error;
}

async function parseMultipartFormData(req, options = {}) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!/multipart\/form-data/i.test(contentType) || !boundaryMatch) {
    throw createMultipartError('Content-Type must be multipart/form-data with a boundary');
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const maxFileSizeBytes = options.maxFileSizeBytes || 10 * 1024 * 1024;
  const bodyBuffer = await readRequestBody(req, maxFileSizeBytes + 1024 * 1024);
  const parts = splitMultipartBody(bodyBuffer, boundary);
  const fields = {};
  let file = null;

  for (const part of parts) {
    const parsedPart = parsePart(part);
    if (!parsedPart) {
      continue;
    }

    if (parsedPart.filename) {
      if (!options.fieldName || parsedPart.name === options.fieldName) {
        if (parsedPart.data.length > maxFileSizeBytes) {
          const error = new Error(`Uploaded file exceeds ${maxFileSizeBytes} bytes`);
          error.code = 'FILE_TOO_LARGE';
          throw error;
        }

        file = {
          fieldName: parsedPart.name,
          originalName: parsedPart.filename,
          filename: buildSafeFilename(parsedPart.filename),
          contentType: parsedPart.contentType,
          buffer: parsedPart.data,
        };
      }

      continue;
    }

    fields[parsedPart.name] = parsedPart.data.toString('utf8').trim();
  }

  return { fields, file };
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        const error = new Error(`Request exceeds ${maxBytes} bytes`);
        error.code = 'FILE_TOO_LARGE';
        reject(error);
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function splitMultipartBody(bodyBuffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = bodyBuffer.indexOf(boundaryBuffer);

  if (start === -1) {
    throw createMultipartError('Could not find multipart boundary in request body');
  }

  while (start !== -1) {
    start += boundaryBuffer.length;

    const isFinalBoundary =
      bodyBuffer[start] === 45 && bodyBuffer[start + 1] === 45;

    if (isFinalBoundary) {
      break;
    }

    if (bodyBuffer[start] === 13 && bodyBuffer[start + 1] === 10) {
      start += 2;
    }

    let end = bodyBuffer.indexOf(boundaryBuffer, start);
    if (end === -1) {
      break;
    }

    if (bodyBuffer[end - 2] === 13 && bodyBuffer[end - 1] === 10) {
      end -= 2;
    }

    parts.push(bodyBuffer.subarray(start, end));
    start = end;
  }

  return parts;
}

function parsePart(partBuffer) {
  const separator = Buffer.from('\r\n\r\n');
  const headerEnd = partBuffer.indexOf(separator);

  if (headerEnd === -1) {
    return null;
  }

  const headers = partBuffer.subarray(0, headerEnd).toString('utf8');
  const data = partBuffer.subarray(headerEnd + separator.length);
  const contentDisposition = headers.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);

  if (!contentDisposition) {
    return null;
  }

  const contentTypeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);

  return {
    name: contentDisposition[1],
    filename: contentDisposition[2],
    contentType: contentTypeMatch ? contentTypeMatch[1].trim() : '',
    data,
  };
}

function buildSafeFilename(filename) {
  const ext = path.extname(filename) || '.pdf';
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${base || 'upload'}-${Date.now()}${ext}`;
}

module.exports = {
  parseMultipartFormData,
};
