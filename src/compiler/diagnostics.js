function clonePoint(point) {
  return {
    offset: point.offset,
    line: point.line,
    column: point.column
  };
}

export function createPoint(offset, line, column) {
  return { offset, line, column };
}

export function createSpan(start, end) {
  return {
    start: clonePoint(start),
    end: clonePoint(end)
  };
}

export function mergeSpans(startLike, endLike) {
  const start = startLike.start ?? startLike;
  const end = endLike.end ?? endLike;
  return createSpan(start, end);
}

export function formatPoint(point) {
  return `line ${point.line}, column ${point.column}`;
}

export class CompilerError extends Error {
  constructor(message, span) {
    super(span ? `${message} at ${formatPoint(span.start)}` : message);
    this.name = "CompilerError";
    this.span = span ?? null;
  }
}
