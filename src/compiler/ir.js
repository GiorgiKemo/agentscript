const REFERENCE_PROPERTIES = new Set(["move-before", "move-after", "switch-position"]);
const CONDITIONAL_ACTIONS = new Set([
  "if-state-equals-literal",
  "if-state-not-equals-literal",
  "if-state-greater-than-literal",
  "if-state-less-than-literal",
  "if-state-equals-state",
  "if-state-not-equals-state",
  "if-state-greater-than-state",
  "if-state-less-than-state"
]);

function buildActionIr(action, stateIndexById, nodeIndexById) {
  if (action.name === "set-state") {
    return {
      name: "set-state",
      targetStateIndex: stateIndexById.get(action.targetStateId),
      sourceStateIndex: stateIndexById.get(action.sourceStateId),
      span: action.span
    };
  }

  if (action.name === "set-literal") {
    return {
      name: "set-literal",
      targetStateIndex: stateIndexById.get(action.targetStateId),
      value: action.value,
      span: action.span
    };
  }

  if (action.name === "reset-state") {
    return {
      name: "reset-state",
      targetStateIndex: stateIndexById.get(action.targetStateId),
      span: action.span
    };
  }

  if (action.name === "show-node" || action.name === "hide-node") {
    return {
      name: action.name,
      targetNodeIndex: nodeIndexById.get(action.targetNodeId),
      span: action.span
    };
  }

  if (action.name === "set-node-text-state") {
    return {
      name: action.name,
      targetNodeIndex: nodeIndexById.get(action.targetNodeId),
      sourceStateIndex: stateIndexById.get(action.sourceStateId),
      span: action.span
    };
  }

  if (action.name === "set-node-text-literal") {
    return {
      name: action.name,
      targetNodeIndex: nodeIndexById.get(action.targetNodeId),
      value: action.value,
      span: action.span
    };
  }

  if (CONDITIONAL_ACTIONS.has(action.name)) {
    const irAction = {
      name: action.name,
      targetStateIndex: stateIndexById.get(action.targetStateId),
      actions: action.actions.map((childAction) => buildActionIr(childAction, stateIndexById, nodeIndexById)),
      elseActions: action.elseActions.map((childAction) => buildActionIr(childAction, stateIndexById, nodeIndexById)),
      span: action.span
    };

    if (action.name.endsWith("-state")) {
      irAction.sourceStateIndex = stateIndexById.get(action.sourceStateId);
    } else {
      irAction.value = action.value;
    }

    return irAction;
  }

  return {
    name: action.name,
    targetStateIndex: stateIndexById.get(action.targetStateId),
    amount: action.amount,
    span: action.span
  };
}

function describeAction(action, program) {
  if (action.name === "set-state") {
    return {
      name: action.name,
      targetStateId: program.states[action.targetStateIndex]?.id ?? null,
      sourceStateId: program.states[action.sourceStateIndex]?.id ?? null
    };
  }

  if (action.name === "set-literal") {
    return {
      name: action.name,
      targetStateId: program.states[action.targetStateIndex]?.id ?? null,
      value: action.value
    };
  }

  if (action.name === "reset-state") {
    return {
      name: action.name,
      targetStateId: program.states[action.targetStateIndex]?.id ?? null
    };
  }

  if (action.name === "show-node" || action.name === "hide-node") {
    return {
      name: action.name,
      targetNodeId: program.nodes[action.targetNodeIndex]?.id ?? null
    };
  }

  if (action.name === "set-node-text-state") {
    return {
      name: action.name,
      targetNodeId: program.nodes[action.targetNodeIndex]?.id ?? null,
      sourceStateId: program.states[action.sourceStateIndex]?.id ?? null
    };
  }

  if (action.name === "set-node-text-literal") {
    return {
      name: action.name,
      targetNodeId: program.nodes[action.targetNodeIndex]?.id ?? null,
      value: action.value
    };
  }

  if (CONDITIONAL_ACTIONS.has(action.name)) {
    const describedAction = {
      name: action.name,
      targetStateId: program.states[action.targetStateIndex]?.id ?? null,
      actions: action.actions.map((childAction) => describeAction(childAction, program)),
      elseActions: action.elseActions.map((childAction) => describeAction(childAction, program))
    };

    if (action.name.endsWith("-state")) {
      describedAction.sourceStateId = program.states[action.sourceStateIndex]?.id ?? null;
    } else {
      describedAction.value = action.value;
    }

    return describedAction;
  }

  return {
    name: action.name,
    targetStateId: program.states[action.targetStateIndex]?.id ?? null,
    amount: action.amount
  };
}

export function buildProgramIr(pageName, nodes, rules, states, handlers) {
  const nodeIndexById = new Map(nodes.map((node, index) => [node.id, index]));
  const stateIndexById = new Map(states.map((state, index) => [state.id, index]));

  return {
    pageName,
    states: states.map((state) => ({
      id: state.id,
      type: state.type,
      initialValue: state.initialValue,
      span: state.span
    })),
    nodes: nodes.map((node) => ({
      kind: node.kind,
      id: node.id,
      text: node.text,
      bindingStateIndex: node.textBinding ? stateIndexById.get(node.textBinding) : 65535,
      parentIndex: node.parentIndex,
      span: node.span
    })),
    rules: rules.map((rule) => ({
      targetIndex: nodeIndexById.get(rule.targetId),
      declarations: rule.declarations.map((declaration) => ({
        name: declaration.name,
        values: REFERENCE_PROPERTIES.has(declaration.name)
          ? [nodeIndexById.get(declaration.values[0])]
          : declaration.values.slice(),
        span: declaration.span
      })),
      span: rule.span
    })),
    handlers: handlers.map((handler) => ({
      eventName: handler.eventName,
      targetIndex: nodeIndexById.get(handler.targetId),
      actions: handler.actions.map((action) => buildActionIr(action, stateIndexById, nodeIndexById)),
      span: handler.span
    }))
  };
}

export function describeProgramIr(program) {
  return {
    pageName: program.pageName,
    states: program.states.map((state, index) => ({
      index,
      id: state.id,
      type: state.type ?? (typeof state.initialValue === "number" ? "number" : "text"),
      initialValue: state.initialValue
    })),
    nodes: program.nodes.map((node, index) => ({
      index,
      kind: node.kind,
      id: node.id,
      text: node.text,
      bindingStateId: node.bindingStateIndex === 65535 ? null : program.states[node.bindingStateIndex]?.id ?? null,
      parentIndex: node.parentIndex
    })),
    rules: program.rules.map((rule) => ({
      targetIndex: rule.targetIndex,
      targetId: program.nodes[rule.targetIndex]?.id ?? null,
      declarations: rule.declarations.map((declaration) => ({
        name: declaration.name,
        values: REFERENCE_PROPERTIES.has(declaration.name)
          ? [program.nodes[declaration.values[0]]?.id ?? null]
          : declaration.values.slice()
      }))
    })),
    handlers: program.handlers.map((handler) => ({
      eventName: handler.eventName,
      targetIndex: handler.targetIndex,
      targetId: program.nodes[handler.targetIndex]?.id ?? null,
      actions: handler.actions.map((action) => describeAction(action, program))
    }))
  };
}
