import { CompilerError, createPoint, createSpan } from "./diagnostics.js";

function isWhitespace(character) {
  return character === " " || character === "\t";
}

function isNewline(character) {
  return character === "\n" || character === "\r";
}

function isWordBoundary(character) {
  return (
    character === undefined ||
    isWhitespace(character) ||
    isNewline(character) ||
    character === "{" ||
    character === "}" ||
    character === '"'
  );
}

export function lexSource(source) {
  const tokens = [];
  let offset = 0;
  let line = 1;
  let column = 1;
  let sawCodeOnLine = false;

  function currentPoint() {
    return createPoint(offset, line, column);
  }

  function peek(length = 1) {
    return source.slice(offset, offset + length);
  }

  function advanceOne() {
    const character = source[offset];
    offset += 1;
    if (character === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return character;
  }

  function consumeNewline() {
    const start = currentPoint();
    if (peek(2) === "\r\n") {
      offset += 2;
      line += 1;
      column = 1;
    } else {
      advanceOne();
    }
    sawCodeOnLine = false;
    tokens.push({
      type: "NEWLINE",
      value: "\n",
      span: createSpan(start, currentPoint())
    });
  }

  function skipComment() {
    while (offset < source.length && !isNewline(source[offset])) {
      advanceOne();
    }
  }

  while (offset < source.length) {
    const character = source[offset];

    if (isWhitespace(character)) {
      advanceOne();
      continue;
    }

    if (isNewline(character)) {
      consumeNewline();
      continue;
    }

    if (!sawCodeOnLine && character === "#") {
      skipComment();
      continue;
    }

    if (!sawCodeOnLine && peek(2) === "//") {
      skipComment();
      continue;
    }

    const start = currentPoint();
    sawCodeOnLine = true;

    if (character === "{") {
      advanceOne();
      tokens.push({
        type: "LBRACE",
        value: "{",
        span: createSpan(start, currentPoint())
      });
      continue;
    }

    if (character === "}") {
      advanceOne();
      tokens.push({
        type: "RBRACE",
        value: "}",
        span: createSpan(start, currentPoint())
      });
      continue;
    }

    if (character === '"') {
      advanceOne();
      let value = "";
      let terminated = false;

      while (offset < source.length) {
        const nextCharacter = source[offset];
        if (nextCharacter === '"') {
          advanceOne();
          terminated = true;
          break;
        }

        if (nextCharacter === "\\") {
          advanceOne();
          const escapeCharacter = source[offset];
          if (escapeCharacter === undefined) {
            break;
          }

          if (escapeCharacter === '"' || escapeCharacter === "\\") {
            value += escapeCharacter;
          } else if (escapeCharacter === "n") {
            value += "\n";
          } else if (escapeCharacter === "t") {
            value += "\t";
          } else {
            value += escapeCharacter;
          }
          advanceOne();
          continue;
        }

        if (isNewline(nextCharacter)) {
          throw new CompilerError("Unterminated string literal", createSpan(start, currentPoint()));
        }

        value += nextCharacter;
        advanceOne();
      }

      if (!terminated) {
        throw new CompilerError("Unterminated string literal", createSpan(start, currentPoint()));
      }

      tokens.push({
        type: "STRING",
        value,
        span: createSpan(start, currentPoint())
      });
      continue;
    }

    let value = "";
    while (!isWordBoundary(source[offset])) {
      value += advanceOne();
    }

    if (value.length === 0) {
      throw new CompilerError(`Unexpected character "${character}"`, createSpan(start, currentPoint()));
    }

    tokens.push({
      type: "WORD",
      value,
      span: createSpan(start, currentPoint())
    });
  }

  const eofPoint = currentPoint();
  tokens.push({
    type: "EOF",
    value: "",
    span: createSpan(eofPoint, eofPoint)
  });

  return tokens;
}
