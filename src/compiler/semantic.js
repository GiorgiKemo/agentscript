import { CompilerError, mergeSpans } from "./diagnostics.js";

const CONTAINER_KINDS = new Set([
  "navbar",
  "hero",
  "main",
  "section",
  "footer",
  "row",
  "column"
]);

const LEAF_KINDS = new Set(["button", "heading", "text", "field"]);
const EVENT_TARGET_KINDS = {
  click: new Set(["button"]),
  input: new Set(["field"])
};

function ensureUniqueId(id, idMap, span) {
  if (idMap.has(id)) {
    throw new CompilerError(`Duplicate id "${id}"`, span);
  }

  idMap.set(id, true);
}

function nextImplicitId(kind, counters) {
  const count = (counters.get(kind) ?? 0) + 1;
  counters.set(kind, count);
  return count === 1 ? kind : `${kind}-${count}`;
}

function parseStateLiteral(valueToken) {
  if (valueToken.type === "STRING") {
    return {
      type: "text",
      value: valueToken.value
    };
  }

  if (/^\d+$/.test(valueToken.value)) {
    return {
      type: "number",
      value: Number(valueToken.value)
    };
  }

  throw new CompilerError("State initializers must be numbers or quoted strings", valueToken.span);
}

function lowerLineAction(actionAst) {
  const parts = actionAst.parts;
  const [head] = parts;

  if (!head) {
    throw new CompilerError("Empty action statement", actionAst.span);
  }

  if (head === "increase" && parts.length === 4 && parts[2] === "by" && /^\d+$/.test(parts[3])) {
    return {
      name: "increase",
      targetStateId: parts[1],
      amount: Number(parts[3]),
      span: actionAst.span
    };
  }

  if (head === "decrease" && parts.length === 4 && parts[2] === "by" && /^\d+$/.test(parts[3])) {
    return {
      name: "decrease",
      targetStateId: parts[1],
      amount: Number(parts[3]),
      span: actionAst.span
    };
  }

  if (head === "add" && parts.length === 4 && /^\d+$/.test(parts[1]) && parts[2] === "to") {
    return {
      name: "increase",
      targetStateId: parts[3],
      amount: Number(parts[1]),
      span: actionAst.span
    };
  }

  if (head === "take" && parts.length === 4 && /^\d+$/.test(parts[1]) && parts[2] === "from") {
    return {
      name: "decrease",
      targetStateId: parts[3],
      amount: Number(parts[1]),
      span: actionAst.span
    };
  }

  if (head === "set" && parts.length === 4 && parts[2] === "to") {
    if (/^\d+$/.test(parts[3])) {
      return {
        name: "set-literal",
        targetStateId: parts[1],
        valueType: "number",
        value: Number(parts[3]),
        span: actionAst.span
      };
    }

    return {
      name: "set-reference-or-text",
      targetStateId: parts[1],
      rawValue: parts[3],
      span: actionAst.span
    };
  }

  if (head === "reset" && parts.length === 2) {
    return {
      name: "reset-state",
      targetStateId: parts[1],
      span: actionAst.span
    };
  }

  if (head === "show" && parts.length === 2) {
    return {
      name: "show-node",
      targetNodeId: parts[1],
      span: actionAst.span
    };
  }

  if (head === "hide" && parts.length === 2) {
    return {
      name: "hide-node",
      targetNodeId: parts[1],
      span: actionAst.span
    };
  }

  if (head === "open" && parts.length === 2) {
    return {
      name: "show-node",
      targetNodeId: parts[1],
      span: actionAst.span
    };
  }

  if (head === "close" && parts.length === 2) {
    return {
      name: "hide-node",
      targetNodeId: parts[1],
      span: actionAst.span
    };
  }

  if (head === "set" && parts.length === 5 && parts[1] === "text" && parts[3] === "to") {
    return {
      name: "set-node-text-raw",
      targetNodeId: parts[2],
      rawValue: parts[4],
      span: actionAst.span
    };
  }

  if (head === "change" && parts.length === 6 && parts[1] === "text" && parts[2] === "of" && parts[4] === "to") {
    return {
      name: "set-node-text-raw",
      targetNodeId: parts[3],
      rawValue: parts[5],
      span: actionAst.span
    };
  }

  throw new CompilerError(`Unknown action statement "${parts.join(" ")}"`, actionAst.span);
}

function lowerConditionalAction(actionAst) {
  const conditionNames = {
    equals: "if-state-equals-raw",
    "not-equals": "if-state-not-equals-raw",
    "greater-than": "if-state-greater-than-raw",
    "less-than": "if-state-less-than-raw"
  };

  return {
    name: conditionNames[actionAst.operator],
    targetStateId: actionAst.targetStateId,
    rawValue: actionAst.valueToken.value,
    rawValueType: actionAst.valueToken.type,
    actions: actionAst.actions.map(lowerActionNode),
    elseActions: actionAst.elseActions.map(lowerActionNode),
    span: actionAst.span
  };
}

function lowerActionNode(actionAst) {
  if (actionAst.type === "ConditionBlock") {
    return lowerConditionalAction(actionAst);
  }

  return lowerLineAction(actionAst);
}

function lowerHandler(handlerAst) {
  return {
    eventName: handlerAst.eventName,
    targetId: handlerAst.targetId,
    actions: handlerAst.actions.map(lowerActionNode),
    span: handlerAst.span
  };
}

function lowerLayoutNode(astNode, state) {
  if (astNode.type === "ContainerNode") {
    if (!CONTAINER_KINDS.has(astNode.kind)) {
      throw new CompilerError(`Unknown container kind "${astNode.kind}"`, astNode.kindSpan);
    }

    const id = astNode.id ?? nextImplicitId(astNode.kind, state.implicitCounters);
    ensureUniqueId(id, state.seenNodeIds, astNode.idSpan ?? astNode.kindSpan);

    const node = {
      kind: astNode.kind,
      id,
      text: "",
      textBinding: null,
      children: [],
      span: astNode.span
    };

    for (const child of astNode.children) {
      node.children.push(lowerLayoutNode(child, state));
    }

    return node;
  }

  if (!LEAF_KINDS.has(astNode.kind)) {
    throw new CompilerError(`Unknown leaf kind "${astNode.kind}"`, astNode.kindSpan);
  }

  ensureUniqueId(astNode.id, state.seenNodeIds, astNode.idSpan);
  return {
    kind: astNode.kind,
    id: astNode.id,
    text: astNode.content.type === "LiteralContent" ? astNode.content.value : "",
    textBinding: astNode.content.type === "BindingContent" ? astNode.content.stateId : null,
    children: [],
    span: astNode.span
  };
}

function parsePx(value, span, propertyName) {
  const match = value.match(/^(\d+)px$/);
  if (!match) {
    throw new CompilerError(`Expected ${propertyName} to be a px value`, span);
  }

  return Number(match[1]);
}

function createStyleDeclaration(name, values, span) {
  return {
    name,
    values,
    span
  };
}

function parseStyleDeclarations(declaration) {
  const parts = declaration.parts;
  const [head] = parts;

  if (!head) {
    throw new CompilerError("Empty style declaration", declaration.span);
  }

  if (head === "color" && parts.length === 2) {
    return [createStyleDeclaration("color", [parts[1]], declaration.span)];
  }

  if (head === "fill" && parts.length === 2) {
    return [createStyleDeclaration("background", [parts[1]], declaration.span)];
  }

  if (head === "background" && parts.length === 2) {
    return [createStyleDeclaration("background", [parts[1]], declaration.span)];
  }

  if (head === "hide" && parts.length === 1) {
    return [createStyleDeclaration("hide", [], declaration.span)];
  }

  if (head === "show" && parts.length === 1) {
    return [createStyleDeclaration("show", [], declaration.span)];
  }

  if (head === "center" && parts.length === 1) {
    return [createStyleDeclaration("center", [], declaration.span)];
  }

  if (head === "center" && parts.length === 2 && parts[1] === "text") {
    return [createStyleDeclaration("text-align", ["center"], declaration.span)];
  }

  if (head === "bold" && parts.length === 1) {
    return [createStyleDeclaration("font-weight", [700], declaration.span)];
  }

  if (head === "shadow" && parts.length === 2 && ["soft", "medium", "strong", "none"].includes(parts[1])) {
    return [createStyleDeclaration("shadow", [parts[1]], declaration.span)];
  }

  if (head === "text" && parts.length === 3 && parts[1] === "color") {
    return [createStyleDeclaration("color", [parts[2]], declaration.span)];
  }

  if (head === "text" && parts.length === 2 && parts[1].startsWith("#") === false && parts[1].endsWith("px")) {
    return [createStyleDeclaration("font-size", [parsePx(parts[1], declaration.span, "text size")], declaration.span)];
  }

  if (head === "text" && parts.length === 3 && parts[1] === "size") {
    return [createStyleDeclaration("font-size", [parsePx(parts[2], declaration.span, "text size")], declaration.span)];
  }

  const directPxProperties = new Set(["font-size", "width", "height", "gap", "radius"]);
  if (directPxProperties.has(head) && parts.length === 2) {
    return [createStyleDeclaration(head, [parsePx(parts[1], declaration.span, head)], declaration.span)];
  }

  if (head === "round" && parts.length === 2) {
    return [createStyleDeclaration("radius", [parsePx(parts[1], declaration.span, "round")], declaration.span)];
  }

  if (head === "space" && parts.length === 2) {
    return [createStyleDeclaration("gap", [parsePx(parts[1], declaration.span, "space")], declaration.span)];
  }

  if (head === "grow" && (parts.length === 1 || (parts.length === 2 && /^\d+$/.test(parts[1])))) {
    return [createStyleDeclaration("grow", [parts.length === 2 ? Number(parts[1]) : 1], declaration.span)];
  }

  if (head === "size" && (parts.length === 2 || parts.length === 3)) {
    const width = parsePx(parts[1], declaration.span, "size");
    const height = parts.length === 3 ? parsePx(parts[2], declaration.span, "size") : width;
    return [
      createStyleDeclaration("width", [width], declaration.span),
      createStyleDeclaration("height", [height], declaration.span)
    ];
  }

  const increasePxProperties = new Set(["font-size", "width", "height"]);
  if (head === "increase" && parts.length === 4 && parts[2] === "by" && increasePxProperties.has(parts[1])) {
    return [createStyleDeclaration(`increase-${parts[1]}`, [parsePx(parts[3], declaration.span, parts[1])], declaration.span)];
  }

  if (head === "increase" && parts.length === 4 && parts[1] === "size" && parts[2] === "by") {
    const amount = parsePx(parts[3], declaration.span, "size");
    return [
      createStyleDeclaration("increase-width", [amount], declaration.span),
      createStyleDeclaration("increase-height", [amount], declaration.span)
    ];
  }

  if (head === "increase" && parts.length === 5 && parts[1] === "text" && parts[2] === "size" && parts[3] === "by") {
    return [createStyleDeclaration("increase-font-size", [parsePx(parts[4], declaration.span, "text size")], declaration.span)];
  }

  if (head === "padding" && parts.length === 3) {
    return [
      createStyleDeclaration(
        "padding",
        [
          parsePx(parts[1], declaration.span, "padding"),
          parsePx(parts[2], declaration.span, "padding")
        ],
        declaration.span
      )
    ];
  }

  if (head === "direction" && parts.length === 2 && (parts[1] === "row" || parts[1] === "column")) {
    return [createStyleDeclaration("direction", [parts[1]], declaration.span)];
  }

  if (head === "stack" && parts.length === 1) {
    return [createStyleDeclaration("direction", ["column"], declaration.span)];
  }

  if (head === "line" && parts.length === 2 && parts[1] === "up") {
    return [createStyleDeclaration("direction", ["row"], declaration.span)];
  }

  if (head === "arrange" && parts.length === 2 && (parts[1] === "row" || parts[1] === "column")) {
    return [createStyleDeclaration("direction", [parts[1]], declaration.span)];
  }

  if (head === "align" && parts.length === 2 && ["start", "center", "end", "stretch"].includes(parts[1])) {
    return [createStyleDeclaration("align-items", [parts[1]], declaration.span)];
  }

  if (head === "justify" && parts.length === 2 && ["start", "center", "end", "between"].includes(parts[1])) {
    return [createStyleDeclaration("justify-content", [parts[1]], declaration.span)];
  }

  if (head === "spread" && parts.length === 2 && parts[1] === "out") {
    return [createStyleDeclaration("justify-content", ["between"], declaration.span)];
  }

  if (head === "center" && parts.length === 2 && parts[1] === "items") {
    return [createStyleDeclaration("align-items", ["center"], declaration.span)];
  }

  if (head === "center" && parts.length === 2 && parts[1] === "content") {
    return [createStyleDeclaration("justify-content", ["center"], declaration.span)];
  }

  if (head === "push" && parts.length === 2 && parts[1] === "right") {
    return [createStyleDeclaration("push-right", [], declaration.span)];
  }

  if (head === "push" && parts.length === 2 && parts[1] === "left") {
    return [createStyleDeclaration("push-left", [], declaration.span)];
  }

  if (head === "move" && parts.length === 3 && parts[1] === "before") {
    return [createStyleDeclaration("move-before", [parts[2]], declaration.span)];
  }

  if (head === "move" && parts.length === 3 && parts[1] === "after") {
    return [createStyleDeclaration("move-after", [parts[2]], declaration.span)];
  }

  if (head === "switch" && parts.length === 4 && parts[1] === "position" && parts[2] === "with") {
    return [createStyleDeclaration("switch-position", [parts[3]], declaration.span)];
  }

  throw new CompilerError(`Unknown style command "${parts.join(" ")}"`, declaration.span);
}

export function lowerLayoutAst(ast) {
  const stateSeenIds = new Map();
  const states = ast.states.map((stateAst) => {
    ensureUniqueId(stateAst.id, stateSeenIds, stateAst.idSpan);
    const initializer = parseStateLiteral(stateAst.valueToken);
    return {
      id: stateAst.id,
      type: initializer.type,
      initialValue: initializer.value,
      span: stateAst.span
    };
  });

  const loweredHandlers = ast.handlers.map(lowerHandler);
  const state = {
    seenNodeIds: new Map([["page", true]]),
    implicitCounters: new Map()
  };

  return {
    kind: "page",
    id: "page",
    pageName: ast.pageName,
    text: "",
    states,
    handlers: loweredHandlers,
    children: ast.body.map((node) => lowerLayoutNode(node, state)),
    span: ast.span
  };
}

export function lowerStyleAst(ast) {
  return ast.rules.map((rule) => ({
    targetKind: rule.targetKind,
    targetId: rule.targetId,
    declarations: rule.declarations.flatMap(parseStyleDeclarations),
    span: rule.span
  }));
}

export function flattenLayout(root) {
  const flatNodes = [];

  function visit(node, parentIndex) {
    for (const child of node.children) {
      const currentIndex = flatNodes.length;
      flatNodes.push({
        kind: child.kind,
        id: child.id,
        text: child.text,
        textBinding: child.textBinding,
        parentIndex,
        span: child.span
      });
      visit(child, currentIndex);
    }
  }

  visit(root, 65535);
  return flatNodes;
}

function validateAction(action, statesById, nodeMap) {
  if (action.name === "show-node" || action.name === "hide-node") {
    if (!nodeMap.has(action.targetNodeId)) {
      throw new CompilerError(`Action targets unknown node "${action.targetNodeId}"`, action.span);
    }

    return action;
  }

  if (action.name === "set-node-text-raw") {
    const targetNode = nodeMap.get(action.targetNodeId);
    if (!targetNode) {
      throw new CompilerError(`Action targets unknown node "${action.targetNodeId}"`, action.span);
    }

    if (!LEAF_KINDS.has(targetNode.kind)) {
      throw new CompilerError(`Text can only be set on leaf nodes, not "${targetNode.kind}"`, action.span);
    }

    if (targetNode.textBinding) {
      throw new CompilerError(`Cannot set text on bound node "${action.targetNodeId}"`, action.span);
    }

    if (statesById.has(action.rawValue)) {
      return {
        name: "set-node-text-state",
        targetNodeId: action.targetNodeId,
        sourceStateId: action.rawValue,
        span: action.span
      };
    }

    return {
      name: "set-node-text-literal",
      targetNodeId: action.targetNodeId,
      value: action.rawValue,
      span: action.span
    };
  }

  if (
    action.name === "if-state-equals-raw" ||
    action.name === "if-state-not-equals-raw" ||
    action.name === "if-state-greater-than-raw" ||
    action.name === "if-state-less-than-raw"
  ) {
    const targetState = statesById.get(action.targetStateId);
    if (!targetState) {
      throw new CompilerError(`Condition targets unknown state "${action.targetStateId}"`, action.span);
    }

    const nestedActions = action.actions.map((childAction) => validateAction(childAction, statesById, nodeMap));
    const elseActions = action.elseActions.map((childAction) => validateAction(childAction, statesById, nodeMap));
    const conditionName = action.name.replace(/-raw$/, "");
    const requiresNumber = conditionName === "if-state-greater-than" || conditionName === "if-state-less-than";

    if (requiresNumber && targetState.type !== "number") {
      throw new CompilerError(`Numeric comparisons require a numeric state "${action.targetStateId}"`, action.span);
    }

    if (action.rawValueType === "STRING") {
      if (requiresNumber) {
        throw new CompilerError(`Numeric comparisons require a number or numeric state after "${action.targetStateId}"`, action.span);
      }

      if (targetState.type !== "text") {
        throw new CompilerError(`Text conditions require a text state "${action.targetStateId}"`, action.span);
      }

      return {
        name: `${conditionName}-literal`,
        targetStateId: action.targetStateId,
        value: action.rawValue,
        actions: nestedActions,
        elseActions,
        span: action.span
      };
    }

    if (/^\d+$/.test(action.rawValue)) {
      if (targetState.type !== "number") {
        throw new CompilerError(`Numeric conditions require a numeric state "${action.targetStateId}"`, action.span);
      }

      return {
        name: `${conditionName}-literal`,
        targetStateId: action.targetStateId,
        value: Number(action.rawValue),
        actions: nestedActions,
        elseActions,
        span: action.span
      };
    }

    if (statesById.has(action.rawValue)) {
      const sourceState = statesById.get(action.rawValue);
      if (sourceState.type !== targetState.type) {
        throw new CompilerError(
          `Cannot compare state "${action.targetStateId}" with state "${action.rawValue}" because their types differ`,
          action.span
        );
      }

      return {
        name: `${conditionName}-state`,
        targetStateId: action.targetStateId,
        sourceStateId: action.rawValue,
        actions: nestedActions,
        elseActions,
        span: action.span
      };
    }

    if (requiresNumber) {
      throw new CompilerError(
        `Numeric comparisons require a number or numeric state after "${action.targetStateId}"`,
        action.span
      );
    }

    if (targetState.type !== "text") {
      throw new CompilerError(
        `Unquoted condition values are only allowed for text state "${action.targetStateId}" when they are state ids`,
        action.span
      );
    }

    return {
      name: `${conditionName}-literal`,
      targetStateId: action.targetStateId,
      value: action.rawValue,
      actions: nestedActions,
      elseActions,
      span: action.span
    };
  }

  const targetState = statesById.get(action.targetStateId);
  if (!targetState) {
    throw new CompilerError(`Action targets unknown state "${action.targetStateId}"`, action.span);
  }

  if (action.name === "reset-state") {
    return action;
  }

  if (action.name === "increase" || action.name === "decrease") {
    if (targetState.type !== "number") {
      throw new CompilerError(`Action requires numeric state "${action.targetStateId}"`, action.span);
    }

    return action;
  }

  if (action.name === "set-literal") {
    if (targetState.type !== action.valueType) {
      throw new CompilerError(
        `Cannot assign ${action.valueType} to ${targetState.type} state "${action.targetStateId}"`,
        action.span
      );
    }

    return action;
  }

  if (action.name === "set-reference-or-text") {
    if (statesById.has(action.rawValue)) {
      const sourceState = statesById.get(action.rawValue);
      if (sourceState.type !== targetState.type) {
        throw new CompilerError(
          `Cannot assign state "${action.rawValue}" to state "${action.targetStateId}" because their types differ`,
          action.span
        );
      }

      return {
        name: "set-state",
        targetStateId: action.targetStateId,
        sourceStateId: action.rawValue,
        span: action.span
      };
    }

    if (targetState.type !== "text") {
      throw new CompilerError(`Text literals can only be assigned to text state "${action.targetStateId}"`, action.span);
    }

    return {
      name: "set-literal",
      targetStateId: action.targetStateId,
      valueType: "text",
      value: action.rawValue,
      span: action.span
    };
  }

  throw new CompilerError(`Unknown action "${action.name}"`, action.span);
}

function validateActions(handlers, statesById, nodeMap) {
  return handlers.map((handler) => ({
    ...handler,
    actions: handler.actions.map((action) => validateAction(action, statesById, nodeMap))
  }));
}

export function validateProgram(root, rules) {
  const flatNodes = flattenLayout(root);
  const nodeMap = new Map(flatNodes.map((node) => [node.id, node]));
  const stateMap = new Map(root.states.map((state) => [state.id, state]));

  for (const node of flatNodes) {
    if (node.textBinding && !stateMap.has(node.textBinding)) {
      throw new CompilerError(`Node "${node.id}" binds unknown state "${node.textBinding}"`, node.span);
    }

    if (node.kind === "field") {
      if (!node.textBinding) {
        throw new CompilerError(`Field "${node.id}" must bind to a state using \`from <state>\``, node.span);
      }

      const boundState = stateMap.get(node.textBinding);
      if (boundState?.type !== "text") {
        throw new CompilerError(`Field "${node.id}" currently requires a text state`, node.span);
      }
    }
  }

  for (const rule of rules) {
    const targetNode = nodeMap.get(rule.targetId);
    if (!targetNode) {
      throw new CompilerError(`Style rule targets unknown id "${rule.targetId}"`, rule.span);
    }

    if (rule.targetKind && rule.targetKind !== targetNode.kind) {
      throw new CompilerError(
        `Style rule expected "${rule.targetId}" to be a ${rule.targetKind}, but it is ${targetNode.kind}`,
        rule.span
      );
    }

    for (const declaration of rule.declarations) {
      if (
        declaration.name === "move-before" ||
        declaration.name === "move-after" ||
        declaration.name === "switch-position"
      ) {
        const referenceId = declaration.values[0];
        if (!nodeMap.has(referenceId)) {
          throw new CompilerError(
            `Style rule on "${rule.targetId}" references unknown id "${referenceId}"`,
            mergeSpans(rule.span, declaration.span)
          );
        }
      }
    }
  }

  const handlers = validateActions(root.handlers, stateMap, nodeMap);
  for (const handler of handlers) {
    const targetNode = nodeMap.get(handler.targetId);
    if (!targetNode) {
      throw new CompilerError(`Event handler targets unknown node "${handler.targetId}"`, handler.span);
    }

    const allowedKinds = EVENT_TARGET_KINDS[handler.eventName];
    if (!allowedKinds) {
      throw new CompilerError(`Unsupported event "${handler.eventName}"`, handler.span);
    }

    if (!allowedKinds.has(targetNode.kind)) {
      throw new CompilerError(
        `${handler.eventName} handlers currently require ${[...allowedKinds].join(" or ")} targets, not "${targetNode.kind}"`,
        handler.span
      );
    }
  }

  return {
    nodes: flatNodes,
    states: root.states,
    handlers
  };
}
