import { parseLayoutAst, parseStyleAst } from "./parser.js";

function quote(value) {
  return JSON.stringify(String(value));
}

function formatLayoutNode(node, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel);

  if (node.type === "BlockUsage") {
    return node.instanceId
      ? `${indent}use block ${node.blockId} as ${node.instanceId}`
      : `${indent}use block ${node.blockId}`;
  }

  if (node.type === "ContainerNode") {
    const header = node.id ? `${node.kind} ${node.id} {` : `${node.kind} {`;
    const childLines = node.children.map((child) => formatLayoutNode(child, indentLevel + 1));
    return `${indent}${header}\n${childLines.join("\n")}\n${indent}}`;
  }

  if (node.content.type === "LiteralContent") {
    return `${indent}${node.kind} ${node.id} ${quote(node.content.value)}`;
  }

  return `${indent}${node.kind} ${node.id} from ${node.content.stateId}`;
}

function formatActionNode(node, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel);

  if (node.type === "ActionStatement") {
    return `${indent}${node.partTokens
      .map((part) => (part.type === "STRING" ? quote(part.value) : part.value))
      .join(" ")}`;
  }

  const operatorText = {
    equals: "is",
    "not-equals": "is not",
    "greater-than": "is greater than",
    "less-than": "is less than"
  }[node.operator];
  const head = `${indent}if ${node.targetStateId} ${operatorText} ${
    node.valueToken.type === "STRING" ? quote(node.valueToken.value) : node.valueToken.value
  } {`;
  const body = node.actions.map((action) => formatActionNode(action, indentLevel + 1)).join("\n");

  if (node.elseActions.length === 0) {
    return `${head}\n${body}\n${indent}}`;
  }

  const elseBody = node.elseActions.map((action) => formatActionNode(action, indentLevel + 1)).join("\n");
  return `${head}\n${body}\n${indent}} else {\n${elseBody}\n${indent}}`;
}

function formatStateDeclaration(state) {
  const value = state.valueToken.type === "STRING" ? quote(state.valueToken.value) : state.valueToken.value;
  return `state ${state.id} ${value}`;
}

function formatPageDefinition(page) {
  const body = page.body.map((node) => formatLayoutNode(node, 1)).join("\n");
  return `create page ${page.id} {\n${body}\n}`;
}

function formatBlockDefinition(block) {
  const body = block.body.map((node) => formatLayoutNode(node, 1)).join("\n");
  return `create block ${block.id} {\n${body}\n}`;
}

function formatHandler(handler) {
  const actionLines = handler.actions.map((action) => formatActionNode(action, 1)).join("\n");
  return `when ${handler.eventName} ${handler.targetId} {\n${actionLines}\n}`;
}

export function formatLayoutAst(ast) {
  const sections = [];

  if (ast.programKind === "app") {
    sections.push(`app ${ast.appName}`);

    if (ast.startPageId) {
      sections.push(`start page ${ast.startPageId}`);
    }

    if (ast.states.length > 0) {
      sections.push(ast.states.map(formatStateDeclaration).join("\n"));
    }

    if (ast.blocks.length > 0) {
      sections.push(ast.blocks.map(formatBlockDefinition).join("\n\n"));
    }

    if (ast.pages.length > 0) {
      sections.push(ast.pages.map(formatPageDefinition).join("\n\n"));
    }

    if (ast.handlers.length > 0) {
      sections.push(ast.handlers.map(formatHandler).join("\n\n"));
    }

    return `${sections.join("\n\n")}\n`;
  }

  sections.push(`page ${ast.pageName}`);

  if (ast.states.length > 0) {
    sections.push(ast.states.map(formatStateDeclaration).join("\n"));
  }

  if (ast.blocks.length > 0) {
    sections.push(ast.blocks.map(formatBlockDefinition).join("\n\n"));
  }

  if (ast.body.length > 0) {
    sections.push(ast.body.map((node) => formatLayoutNode(node, 0)).join("\n\n"));
  }

  if (ast.handlers.length > 0) {
    sections.push(ast.handlers.map(formatHandler).join("\n\n"));
  }

  return `${sections.join("\n\n")}\n`;
}

function formatStyleDeclaration(declaration, indentLevel = 1) {
  const indent = "  ".repeat(indentLevel);
  const tokens = declaration.partTokens ?? declaration.parts.map((part) => ({ type: "WORD", value: part }));
  return `${indent}${tokens.map((part) => (part.type === "STRING" ? quote(part.value) : part.value)).join(" ")}`;
}

function formatStyleRule(rule) {
  const selector = rule.targetKind ? `${rule.targetKind} ${rule.targetId}` : rule.targetId;
  const declarations = rule.declarations.map((declaration) => formatStyleDeclaration(declaration)).join("\n");
  return `select ${selector} {\n${declarations}\n}`;
}

export function formatStyleAst(ast) {
  if (ast.rules.length === 0) {
    return "";
  }

  return `${ast.rules.map(formatStyleRule).join("\n\n")}\n`;
}

export function formatLayoutSource(source) {
  return formatLayoutAst(parseLayoutAst(source));
}

export function formatStyleSource(source) {
  return formatStyleAst(parseStyleAst(source));
}
