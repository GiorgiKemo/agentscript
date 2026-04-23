import { CompilerError, mergeSpans } from "./diagnostics.js";
import { lexSource } from "./lexer.js";

class TokenStream {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  current(offset = 0) {
    const position = this.index + offset;
    if (position < 0) {
      return this.tokens[0];
    }
    return this.tokens[position] ?? this.tokens[this.tokens.length - 1];
  }

  consume() {
    const token = this.current();
    this.index += 1;
    return token;
  }

  match(type, value) {
    const token = this.current();
    return token.type === type && (value === undefined || token.value === value);
  }

  expect(type, message, value) {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new CompilerError(message, token.span);
    }
    return this.consume();
  }

  skipNewlines() {
    while (this.match("NEWLINE")) {
      this.consume();
    }
  }
}

function expectWord(stream, message, value) {
  return stream.expect("WORD", message, value);
}

function requireStatementBoundary(stream, context) {
  const token = stream.current();
  if (token.type === "NEWLINE") {
    stream.skipNewlines();
    return;
  }

  if (token.type === "RBRACE" || token.type === "EOF") {
    return;
  }

  throw new CompilerError(`Expected end of ${context}`, token.span);
}

function parseLineParts(stream, context) {
  const parts = [];
  const firstToken = stream.current();

  while (!stream.match("NEWLINE") && !stream.match("RBRACE") && !stream.match("EOF")) {
    const token = stream.current();
    if (token.type !== "WORD" && token.type !== "STRING") {
      throw new CompilerError(`Unexpected token inside ${context}`, token.span);
    }
    parts.push(token);
    stream.consume();
  }

  if (parts.length === 0) {
    throw new CompilerError(`Expected a ${context}`, firstToken.span);
  }

  const span = mergeSpans(parts[0].span, parts[parts.length - 1].span);
  requireStatementBoundary(stream, context);
  return { parts, span };
}

function parseLayoutStatement(stream) {
  const kindToken = expectWord(stream, "Expected a layout node kind");
  if (kindToken.value === "use") {
    expectWord(stream, 'Expected `block` after `use`', "block");
    const blockIdToken = expectWord(stream, "Expected a block id after `use block`");
    let instanceId = null;
    let instanceIdSpan = null;

    if (stream.match("WORD", "as")) {
      stream.consume();
      const instanceIdToken = expectWord(stream, "Expected an instance id after `as`");
      instanceId = instanceIdToken.value;
      instanceIdSpan = instanceIdToken.span;
    }

    const blockUsage = {
      type: "BlockUsage",
      blockId: blockIdToken.value,
      blockIdSpan: blockIdToken.span,
      instanceId,
      instanceIdSpan,
      span: mergeSpans(kindToken.span, instanceIdSpan ?? blockIdToken.span)
    };
    requireStatementBoundary(stream, "block usage");
    return blockUsage;
  }

  const nextToken = stream.current();

  if (nextToken.type === "LBRACE") {
    stream.consume();
    stream.skipNewlines();
    const children = [];
    while (!stream.match("RBRACE")) {
      if (stream.match("EOF")) {
        throw new CompilerError("Unclosed layout block", kindToken.span);
      }
      children.push(parseLayoutStatement(stream));
    }
    const closeToken = stream.consume();
    const node = {
      type: "ContainerNode",
      kind: kindToken.value,
      kindSpan: kindToken.span,
      id: null,
      idSpan: null,
      children,
      span: mergeSpans(kindToken.span, closeToken.span)
    };
    requireStatementBoundary(stream, "layout block");
    return node;
  }

  if (nextToken.type !== "WORD") {
    throw new CompilerError("Expected an id or block after layout node kind", nextToken.span);
  }

  const idToken = stream.consume();
  if (stream.match("LBRACE")) {
    stream.consume();
    stream.skipNewlines();
    const children = [];
    while (!stream.match("RBRACE")) {
      if (stream.match("EOF")) {
        throw new CompilerError("Unclosed layout block", kindToken.span);
      }
      children.push(parseLayoutStatement(stream));
    }
    const closeToken = stream.consume();
    const node = {
      type: "ContainerNode",
      kind: kindToken.value,
      kindSpan: kindToken.span,
      id: idToken.value,
      idSpan: idToken.span,
      children,
      span: mergeSpans(kindToken.span, closeToken.span)
    };
    requireStatementBoundary(stream, "layout block");
    return node;
  }

  if (stream.match("STRING")) {
    const textToken = stream.consume();
    const node = {
      type: "LeafNode",
      kind: kindToken.value,
      kindSpan: kindToken.span,
      id: idToken.value,
      idSpan: idToken.span,
      content: {
        type: "LiteralContent",
        value: textToken.value,
        span: textToken.span
      },
      span: mergeSpans(kindToken.span, textToken.span)
    };
    requireStatementBoundary(stream, "layout statement");
    return node;
  }

  if (stream.match("WORD", "from")) {
    const fromToken = stream.consume();
    const stateToken = expectWord(stream, "Expected a state id after `from`");
    const node = {
      type: "LeafNode",
      kind: kindToken.value,
      kindSpan: kindToken.span,
      id: idToken.value,
      idSpan: idToken.span,
      content: {
        type: "BindingContent",
        stateId: stateToken.value,
        stateSpan: stateToken.span,
        span: mergeSpans(fromToken.span, stateToken.span)
      },
      span: mergeSpans(kindToken.span, stateToken.span)
    };
    requireStatementBoundary(stream, "layout statement");
    return node;
  }

  throw new CompilerError("Expected either a block, a quoted string, or `from <state>`", stream.current().span);
}

function parsePageDefinition(stream) {
  const createToken = expectWord(stream, 'Expected "create"', "create");
  expectWord(stream, 'Expected `page` after `create`', "page");
  const idToken = expectWord(stream, "Expected a page id after `create page`");
  stream.expect("LBRACE", 'Expected "{" after page id');
  stream.skipNewlines();

  const body = [];
  while (!stream.match("RBRACE")) {
    if (stream.match("EOF")) {
      throw new CompilerError("Unclosed page block", createToken.span);
    }
    body.push(parseLayoutStatement(stream));
  }

  const closeToken = stream.consume();
  const definition = {
    type: "PageDefinition",
    id: idToken.value,
    idSpan: idToken.span,
    body,
    span: mergeSpans(createToken.span, closeToken.span)
  };
  requireStatementBoundary(stream, "page block");
  return definition;
}

function parseBlockDefinition(stream) {
  const createToken = expectWord(stream, 'Expected "create"', "create");
  expectWord(stream, 'Expected `block` after `create`', "block");
  const idToken = expectWord(stream, "Expected a block id after `create block`");
  stream.expect("LBRACE", 'Expected "{" after block id');
  stream.skipNewlines();

  const body = [];
  while (!stream.match("RBRACE")) {
    if (stream.match("EOF")) {
      throw new CompilerError("Unclosed block definition", createToken.span);
    }
    body.push(parseLayoutStatement(stream));
  }

  const closeToken = stream.consume();
  const definition = {
    type: "BlockDefinition",
    id: idToken.value,
    idSpan: idToken.span,
    body,
    span: mergeSpans(createToken.span, closeToken.span)
  };
  requireStatementBoundary(stream, "block definition");
  return definition;
}

function parseStartPageDeclaration(stream) {
  const startToken = expectWord(stream, 'Expected "start"', "start");
  expectWord(stream, 'Expected `page` after `start`', "page");
  const idToken = expectWord(stream, "Expected a page id after `start page`");
  const declaration = {
    type: "StartPageDeclaration",
    pageId: idToken.value,
    pageIdSpan: idToken.span,
    span: mergeSpans(startToken.span, idToken.span)
  };
  requireStatementBoundary(stream, "start page declaration");
  return declaration;
}

function parseStateDeclaration(stream) {
  const stateToken = expectWord(stream, 'Expected "state"', "state");
  const idToken = expectWord(stream, "Expected a state id");
  const valueToken = stream.current();

  if (valueToken.type !== "WORD" && valueToken.type !== "STRING") {
    throw new CompilerError("Expected a literal state initializer", valueToken.span);
  }

  stream.consume();
  const declaration = {
    type: "StateDeclaration",
    id: idToken.value,
    idSpan: idToken.span,
    valueToken: {
      type: valueToken.type,
      value: valueToken.value,
      span: valueToken.span
    },
    span: mergeSpans(stateToken.span, valueToken.span)
  };
  requireStatementBoundary(stream, "state declaration");
  return declaration;
}

function parseActionStatement(stream) {
  const { parts, span } = parseLineParts(stream, "action statement");
  return {
    type: "ActionStatement",
    partTokens: parts.map((token) => ({
      type: token.type,
      value: token.value
    })),
    parts: parts.map((token) => token.value),
    span
  };
}

function parseConditionalAction(stream) {
  const ifToken = expectWord(stream, 'Expected "if"', "if");
  const stateToken = expectWord(stream, "Expected a state id after `if`");
  expectWord(stream, 'Expected `is` after the condition state', "is");

  let operator = "equals";
  if (stream.match("WORD", "not")) {
    stream.consume();
    operator = "not-equals";
  } else if (stream.match("WORD", "greater")) {
    stream.consume();
    expectWord(stream, 'Expected `than` after `greater`', "than");
    operator = "greater-than";
  } else if (stream.match("WORD", "less")) {
    stream.consume();
    expectWord(stream, 'Expected `than` after `less`', "than");
    operator = "less-than";
  }

  const valueToken = stream.current();
  if (valueToken.type !== "WORD" && valueToken.type !== "STRING") {
    throw new CompilerError("Expected a literal or state id in the condition", valueToken.span);
  }
  stream.consume();

  stream.expect("LBRACE", 'Expected "{" after condition');
  stream.skipNewlines();

  const actions = [];
  while (!stream.match("RBRACE")) {
    if (stream.match("EOF")) {
      throw new CompilerError("Unclosed condition block", ifToken.span);
    }
    actions.push(parseActionNode(stream));
  }

  const closeToken = stream.consume();
  let hadTrailingNewline = false;
  if (stream.match("NEWLINE")) {
    hadTrailingNewline = true;
    stream.skipNewlines();
  }

  let elseActions = [];
  let finalSpan = mergeSpans(ifToken.span, closeToken.span);
  if (stream.match("WORD", "else")) {
    const elseToken = stream.consume();
    stream.expect("LBRACE", 'Expected "{" after `else`');
    stream.skipNewlines();

    while (!stream.match("RBRACE")) {
      if (stream.match("EOF")) {
        throw new CompilerError("Unclosed else block", elseToken.span);
      }
      elseActions.push(parseActionNode(stream));
    }

    const elseCloseToken = stream.consume();
    finalSpan = mergeSpans(ifToken.span, elseCloseToken.span);
    requireStatementBoundary(stream, "else block");
  } else if (!hadTrailingNewline) {
    requireStatementBoundary(stream, "condition block");
  }

  const block = {
    type: "ConditionBlock",
    targetStateId: stateToken.value,
    targetStateSpan: stateToken.span,
    operator,
    valueToken: {
      type: valueToken.type,
      value: valueToken.value,
      span: valueToken.span
    },
    actions,
    elseActions,
    span: finalSpan
  };
  return block;
}

function parseActionNode(stream) {
  if (stream.match("WORD", "if")) {
    return parseConditionalAction(stream);
  }

  if (stream.match("WORD", "else")) {
    throw new CompilerError("`else` must follow an `if` block", stream.current().span);
  }

  return parseActionStatement(stream);
}

function parseEventHandler(stream) {
  const whenToken = expectWord(stream, 'Expected "when"', "when");
  const eventToken = expectWord(stream, "Expected an event name after `when`");
  const targetToken = expectWord(stream, "Expected a target id after the event name");
  stream.expect("LBRACE", 'Expected "{" after event handler target');
  stream.skipNewlines();

  const actions = [];
  while (!stream.match("RBRACE")) {
    if (stream.match("EOF")) {
      throw new CompilerError("Unclosed event handler block", whenToken.span);
    }
    actions.push(parseActionNode(stream));
  }

  const closeToken = stream.consume();
  const handler = {
    type: "EventHandler",
    eventName: eventToken.value,
    eventSpan: eventToken.span,
    targetId: targetToken.value,
    targetSpan: targetToken.span,
    actions,
    span: mergeSpans(whenToken.span, closeToken.span)
  };
  requireStatementBoundary(stream, "event handler block");
  return handler;
}

export function parseLayoutAst(source) {
  const stream = new TokenStream(lexSource(source));
  stream.skipNewlines();

  if (stream.match("WORD", "page")) {
    const pageToken = expectWord(stream, 'Expected a page declaration starting with "page"', "page");
    const pageNameToken = expectWord(stream, "Expected a page name after `page`");
    requireStatementBoundary(stream, "page declaration");

    const states = [];
    const handlers = [];
    const blocks = [];
    const body = [];

    while (!stream.match("EOF")) {
      stream.skipNewlines();
      if (stream.match("EOF")) {
        break;
      }

      if (stream.match("WORD", "state")) {
        states.push(parseStateDeclaration(stream));
        continue;
      }

      if (stream.match("WORD", "when")) {
        handlers.push(parseEventHandler(stream));
        continue;
      }

      if (stream.match("WORD", "create") && stream.current(1).type === "WORD" && stream.current(1).value === "block") {
        blocks.push(parseBlockDefinition(stream));
        continue;
      }

      body.push(parseLayoutStatement(stream));
    }

    const pages = [
      {
        type: "PageDefinition",
        id: "main",
        idSpan: pageNameToken.span,
        body,
        span: body.length > 0 ? mergeSpans(body[0].span, body[body.length - 1].span) : pageNameToken.span
      }
    ];

    const endSpan =
      handlers[handlers.length - 1]?.span ??
      body[body.length - 1]?.span ??
      blocks[blocks.length - 1]?.span ??
      states[states.length - 1]?.span ??
      pageNameToken.span;

    return {
      type: "LayoutProgram",
      programKind: "single-page",
      appName: pageNameToken.value,
      pageName: pageNameToken.value,
      pageNameSpan: pageNameToken.span,
      startPageId: "main",
      startPageSpan: pageNameToken.span,
      states,
      handlers,
      blocks,
      pages,
      body,
      span: mergeSpans(pageToken.span, endSpan)
    };
  }

  const appToken = expectWord(stream, 'Expected a page or app declaration starting with "page" or "app"', "app");
  const appNameToken = expectWord(stream, "Expected an app name after `app`");
  requireStatementBoundary(stream, "app declaration");

  const states = [];
  const handlers = [];
  const blocks = [];
  const pages = [];
  let startPage = null;

  while (!stream.match("EOF")) {
    stream.skipNewlines();
    if (stream.match("EOF")) {
      break;
    }

    if (stream.match("WORD", "state")) {
      states.push(parseStateDeclaration(stream));
      continue;
    }

    if (stream.match("WORD", "when")) {
      handlers.push(parseEventHandler(stream));
      continue;
    }

    if (stream.match("WORD", "start")) {
      if (startPage) {
        throw new CompilerError("Only one `start page` declaration is allowed", stream.current().span);
      }
      startPage = parseStartPageDeclaration(stream);
      continue;
    }

    if (stream.match("WORD", "create") && stream.current(1).type === "WORD" && stream.current(1).value === "block") {
      blocks.push(parseBlockDefinition(stream));
      continue;
    }

    if (stream.match("WORD", "create")) {
      pages.push(parsePageDefinition(stream));
      continue;
    }

    throw new CompilerError("Expected `state`, `start page`, `create page`, `create block`, or `when`", stream.current().span);
  }

  const endSpan =
    handlers[handlers.length - 1]?.span ??
    pages[pages.length - 1]?.span ??
    blocks[blocks.length - 1]?.span ??
    states[states.length - 1]?.span ??
    startPage?.span ??
    appNameToken.span;

  return {
    type: "LayoutProgram",
    programKind: "app",
    appName: appNameToken.value,
    pageName: appNameToken.value,
    pageNameSpan: appNameToken.span,
    startPageId: startPage?.pageId ?? null,
    startPageSpan: startPage?.pageIdSpan ?? null,
    states,
    handlers,
    blocks,
    pages,
    body: [],
    span: mergeSpans(appToken.span, endSpan)
  };
}

function parseStyleDeclaration(stream) {
  const { parts, span } = parseLineParts(stream, "style declaration");
  return {
    type: "StyleDeclaration",
    partTokens: parts.map((token) => ({
      type: token.type,
      value: token.value
    })),
    parts: parts.map((token) => token.value),
    span
  };
}

function parseStyleRule(stream) {
  const selectToken = expectWord(stream, 'Expected "select"', "select");
  const selectors = [];

  while (!stream.match("LBRACE")) {
    if (!stream.match("WORD")) {
      throw new CompilerError('Expected a selector before "{"', stream.current().span);
    }
    selectors.push(stream.consume());
  }

  if (selectors.length === 0 || selectors.length > 2) {
    throw new CompilerError("Style selectors must be `select id` or `select kind id`", selectToken.span);
  }

  stream.consume();
  stream.skipNewlines();
  const declarations = [];
  while (!stream.match("RBRACE")) {
    if (stream.match("EOF")) {
      throw new CompilerError("Unclosed style block", selectToken.span);
    }
    declarations.push(parseStyleDeclaration(stream));
  }
  const closeToken = stream.consume();
  const rule = {
    type: "StyleRule",
    targetKind: selectors.length === 2 ? selectors[0].value : null,
    targetKindSpan: selectors.length === 2 ? selectors[0].span : null,
    targetId: selectors.length === 2 ? selectors[1].value : selectors[0].value,
    targetIdSpan: selectors.length === 2 ? selectors[1].span : selectors[0].span,
    declarations,
    span: mergeSpans(selectToken.span, closeToken.span)
  };
  requireStatementBoundary(stream, "style block");
  return rule;
}

export function parseStyleAst(source) {
  const stream = new TokenStream(lexSource(source));
  stream.skipNewlines();
  const rules = [];

  while (!stream.match("EOF")) {
    rules.push(parseStyleRule(stream));
    stream.skipNewlines();
  }

  return {
    type: "StyleProgram",
    rules,
    span: rules.length === 0 ? stream.current().span : mergeSpans(rules[0].span, rules[rules.length - 1].span)
  };
}
