const MAGIC = Buffer.from("AWUI");
const VERSION = 11;
const NONE_INDEX = 65535;

export const KIND_CODES = {
  navbar: 1,
  hero: 2,
  main: 3,
  section: 4,
  footer: 5,
  row: 6,
  column: 7,
  button: 20,
  heading: 21,
  text: 22,
  field: 23
};

export const KIND_NAMES = Object.fromEntries(
  Object.entries(KIND_CODES).map(([name, code]) => [code, name])
);

export const PROPERTY_CODES = {
  color: 1,
  background: 2,
  "font-size": 3,
  "increase-font-size": 4,
  width: 5,
  "increase-width": 6,
  height: 7,
  "increase-height": 8,
  gap: 9,
  radius: 10,
  padding: 11,
  direction: 12,
  "move-before": 13,
  "move-after": 14,
  "switch-position": 15,
  hide: 16,
  show: 17,
  "align-items": 18,
  "justify-content": 19,
  center: 20,
  "font-weight": 21,
  "text-align": 22,
  shadow: 23,
  grow: 24,
  "push-right": 25,
  "push-left": 26
};

export const PROPERTY_NAMES = Object.fromEntries(
  Object.entries(PROPERTY_CODES).map(([name, code]) => [code, name])
);

export const ACTION_CODES = {
  "set-literal": 1,
  "set-state": 2,
  increase: 3,
  decrease: 4,
  "show-node": 5,
  "hide-node": 6,
  "set-node-text-literal": 7,
  "set-node-text-state": 8,
  "reset-state": 9,
  "if-state-equals-literal": 10,
  "if-state-equals-state": 11,
  "if-state-not-equals-literal": 12,
  "if-state-not-equals-state": 13,
  "if-state-greater-than-literal": 14,
  "if-state-greater-than-state": 15,
  "if-state-less-than-literal": 16,
  "if-state-less-than-state": 17
};

export const ACTION_NAMES = Object.fromEntries(
  Object.entries(ACTION_CODES).map(([name, code]) => [code, name])
);

export const EVENT_CODES = {
  click: 1,
  input: 2
};

export const EVENT_NAMES = Object.fromEntries(
  Object.entries(EVENT_CODES).map(([name, code]) => [code, name])
);

const VALUE_TYPES = {
  number: 1,
  string: 2
};
const CONDITIONAL_LITERAL_ACTIONS = new Set([
  "if-state-equals-literal",
  "if-state-not-equals-literal",
  "if-state-greater-than-literal",
  "if-state-less-than-literal"
]);
const CONDITIONAL_STATE_ACTIONS = new Set([
  "if-state-equals-state",
  "if-state-not-equals-state",
  "if-state-greater-than-state",
  "if-state-less-than-state"
]);

class BinaryWriter {
  constructor() {
    this.parts = [];
  }

  writeUint8(value) {
    const buffer = Buffer.allocUnsafe(1);
    buffer.writeUInt8(value, 0);
    this.parts.push(buffer);
  }

  writeUint16(value) {
    const buffer = Buffer.allocUnsafe(2);
    buffer.writeUInt16BE(value, 0);
    this.parts.push(buffer);
  }

  writeString(value) {
    const buffer = Buffer.from(value, "utf8");
    this.writeUint16(buffer.length);
    this.parts.push(buffer);
  }

  toBuffer() {
    return Buffer.concat(this.parts);
  }
}

class BinaryReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  readUint8() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16() {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readString() {
    const length = this.readUint16();
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}

function encodeValue(writer, value) {
  if (typeof value === "number") {
    writer.writeUint8(VALUE_TYPES.number);
    writer.writeUint16(value);
    return;
  }

  writer.writeUint8(VALUE_TYPES.string);
  writer.writeString(String(value));
}

function decodeValue(reader) {
  const type = reader.readUint8();
  if (type === VALUE_TYPES.number) {
    return reader.readUint16();
  }

  if (type === VALUE_TYPES.string) {
    return reader.readString();
  }

  throw new Error(`Unknown value type code "${type}"`);
}

function encodeAction(writer, action) {
  const actionCode = ACTION_CODES[action.name];
  if (!actionCode) {
    throw new Error(`Unknown action "${action.name}"`);
  }

  writer.writeUint8(actionCode);

  if (action.name === "show-node" || action.name === "hide-node") {
    writer.writeUint16(action.targetNodeIndex);
    return;
  }

  if (action.name === "reset-state") {
    writer.writeUint16(action.targetStateIndex);
    return;
  }

  if (action.name === "set-node-text-state") {
    writer.writeUint16(action.targetNodeIndex);
    writer.writeUint16(action.sourceStateIndex);
    return;
  }

  if (action.name === "set-node-text-literal") {
    writer.writeUint16(action.targetNodeIndex);
    encodeValue(writer, action.value);
    return;
  }

  if (CONDITIONAL_LITERAL_ACTIONS.has(action.name)) {
    writer.writeUint16(action.targetStateIndex);
    encodeValue(writer, action.value);
    writer.writeUint16(action.actions.length);
    for (const nestedAction of action.actions) {
      encodeAction(writer, nestedAction);
    }
    writer.writeUint16(action.elseActions.length);
    for (const nestedAction of action.elseActions) {
      encodeAction(writer, nestedAction);
    }
    return;
  }

  if (CONDITIONAL_STATE_ACTIONS.has(action.name)) {
    writer.writeUint16(action.targetStateIndex);
    writer.writeUint16(action.sourceStateIndex);
    writer.writeUint16(action.actions.length);
    for (const nestedAction of action.actions) {
      encodeAction(writer, nestedAction);
    }
    writer.writeUint16(action.elseActions.length);
    for (const nestedAction of action.elseActions) {
      encodeAction(writer, nestedAction);
    }
    return;
  }

  writer.writeUint16(action.targetStateIndex);

  if (action.name === "set-state") {
    writer.writeUint16(action.sourceStateIndex);
    return;
  }

  if (action.name === "set-literal") {
    encodeValue(writer, action.value);
    return;
  }

  writer.writeUint16(action.amount);
}

function decodeAction(reader) {
  const actionCode = reader.readUint8();
  const actionName = ACTION_NAMES[actionCode];
  const targetIndex = reader.readUint16();

  if (actionName === "show-node" || actionName === "hide-node") {
    return {
      name: actionName,
      targetNodeIndex: targetIndex
    };
  }

  if (actionName === "reset-state") {
    return {
      name: actionName,
      targetStateIndex: targetIndex
    };
  }

  if (actionName === "set-node-text-state") {
    return {
      name: actionName,
      targetNodeIndex: targetIndex,
      sourceStateIndex: reader.readUint16()
    };
  }

  if (actionName === "set-node-text-literal") {
    return {
      name: actionName,
      targetNodeIndex: targetIndex,
      value: decodeValue(reader)
    };
  }

  if (CONDITIONAL_LITERAL_ACTIONS.has(actionName)) {
    const value = decodeValue(reader);
    const actionCount = reader.readUint16();
    const actions = [];
    for (let index = 0; index < actionCount; index += 1) {
      actions.push(decodeAction(reader));
    }
    const elseActionCount = reader.readUint16();
    const elseActions = [];
    for (let index = 0; index < elseActionCount; index += 1) {
      elseActions.push(decodeAction(reader));
    }

    return {
      name: actionName,
      targetStateIndex: targetIndex,
      value,
      actions,
      elseActions
    };
  }

  if (CONDITIONAL_STATE_ACTIONS.has(actionName)) {
    const sourceStateIndex = reader.readUint16();
    const actionCount = reader.readUint16();
    const actions = [];
    for (let index = 0; index < actionCount; index += 1) {
      actions.push(decodeAction(reader));
    }
    const elseActionCount = reader.readUint16();
    const elseActions = [];
    for (let index = 0; index < elseActionCount; index += 1) {
      elseActions.push(decodeAction(reader));
    }

    return {
      name: actionName,
      targetStateIndex: targetIndex,
      sourceStateIndex,
      actions,
      elseActions
    };
  }

  if (actionName === "set-state") {
    return {
      name: actionName,
      targetStateIndex: targetIndex,
      sourceStateIndex: reader.readUint16()
    };
  }

  if (actionName === "set-literal") {
    return {
      name: actionName,
      targetStateIndex: targetIndex,
      value: decodeValue(reader)
    };
  }

  return {
    name: actionName,
    targetStateIndex: targetIndex,
    amount: reader.readUint16()
  };
}

export function encodeProgram(program) {
  const writer = new BinaryWriter();
  writer.parts.push(MAGIC);
  writer.writeUint8(VERSION);
  writer.writeString(program.pageName);

  writer.writeUint16(program.states.length);
  for (const state of program.states) {
    writer.writeString(state.id);
    encodeValue(writer, state.initialValue);
  }

  writer.writeUint16(program.nodes.length);
  for (const node of program.nodes) {
    const kindCode = KIND_CODES[node.kind];
    if (!kindCode) {
      throw new Error(`Unknown kind "${node.kind}"`);
    }

    writer.writeUint8(kindCode);
    writer.writeString(node.id);
    writer.writeString(node.text ?? "");
    writer.writeUint16(node.bindingStateIndex ?? NONE_INDEX);
    writer.writeUint16(node.parentIndex);
  }

  writer.writeUint16(program.rules.length);
  for (const rule of program.rules) {
    writer.writeUint16(rule.targetIndex);
    writer.writeUint16(rule.declarations.length);

    for (const declaration of rule.declarations) {
      const propertyCode = PROPERTY_CODES[declaration.name];
      if (!propertyCode) {
        throw new Error(`Unknown property "${declaration.name}"`);
      }

      writer.writeUint8(propertyCode);
      writer.writeUint8(declaration.values.length);
      for (const value of declaration.values) {
        encodeValue(writer, value);
      }
    }
  }

  writer.writeUint16(program.handlers.length);
  for (const handler of program.handlers) {
    const eventCode = EVENT_CODES[handler.eventName];
    if (!eventCode) {
      throw new Error(`Unknown event "${handler.eventName}"`);
    }

    writer.writeUint8(eventCode);
    writer.writeUint16(handler.targetIndex);
    writer.writeUint16(handler.actions.length);

    for (const action of handler.actions) {
      encodeAction(writer, action);
    }
  }

  return writer.toBuffer();
}

export function decodeProgram(buffer) {
  const reader = new BinaryReader(buffer);
  const magic = buffer.subarray(0, 4);
  if (!magic.equals(MAGIC)) {
    throw new Error("Invalid bytecode header");
  }

  reader.offset = 4;
  const version = reader.readUint8();
  if (version !== VERSION) {
    throw new Error(`Unsupported bytecode version "${version}"`);
  }

  const pageName = reader.readString();

  const stateCount = reader.readUint16();
  const states = [];
  for (let index = 0; index < stateCount; index += 1) {
    states.push({
      id: reader.readString(),
      initialValue: decodeValue(reader)
    });
  }

  const nodeCount = reader.readUint16();
  const nodes = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const kindCode = reader.readUint8();
    nodes.push({
      kind: KIND_NAMES[kindCode],
      id: reader.readString(),
      text: reader.readString(),
      bindingStateIndex: reader.readUint16(),
      parentIndex: reader.readUint16()
    });
  }

  const ruleCount = reader.readUint16();
  const rules = [];
  for (let index = 0; index < ruleCount; index += 1) {
    const targetIndex = reader.readUint16();
    const declarationCount = reader.readUint16();
    const declarations = [];

    for (let declarationIndex = 0; declarationIndex < declarationCount; declarationIndex += 1) {
      const propertyCode = reader.readUint8();
      const valueCount = reader.readUint8();
      const values = [];
      for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
        values.push(decodeValue(reader));
      }

      declarations.push({
        name: PROPERTY_NAMES[propertyCode],
        values
      });
    }

    rules.push({
      targetIndex,
      declarations
    });
  }

  const handlerCount = reader.readUint16();
  const handlers = [];
  for (let index = 0; index < handlerCount; index += 1) {
    const eventCode = reader.readUint8();
    const targetIndex = reader.readUint16();
    const actionCount = reader.readUint16();
    const actions = [];

    for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
      actions.push(decodeAction(reader));
    }

    handlers.push({
      eventName: EVENT_NAMES[eventCode],
      targetIndex,
      actions
    });
  }

  return {
    pageName,
    states,
    nodes,
    rules,
    handlers
  };
}
