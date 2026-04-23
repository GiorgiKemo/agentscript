import { parseLayoutAst, parseStyleAst } from "./parser.js";
import { lowerLayoutAst, lowerStyleAst, validateProgram } from "./semantic.js";
import { buildProgramIr } from "./ir.js";
import { encodeProgram } from "./bytecode.js";
import { renderProgram } from "../runtime/render.js";

export function checkSources(layoutSource, styleSource) {
  const layoutAst = parseLayoutAst(layoutSource);
  const styleAst = parseStyleAst(styleSource);
  const root = lowerLayoutAst(layoutAst);
  const rules = lowerStyleAst(styleAst);
  const validation = validateProgram(root, rules);
  const ir = buildProgramIr(root.pageName, validation.nodes, rules, validation.states, validation.handlers);

  return {
    layoutAst,
    styleAst,
    root,
    rules,
    nodes: validation.nodes,
    states: validation.states,
    handlers: validation.handlers,
    ir,
    program: {
      pageName: root.pageName,
      nodes: validation.nodes,
      states: validation.states,
      handlers: validation.handlers,
      rules
    }
  };
}

export function compileSources(layoutSource, styleSource) {
  const checked = checkSources(layoutSource, styleSource);
  const bytecode = encodeProgram(checked.ir);
  const rendered = renderProgram(bytecode);

  return {
    ...checked,
    bytecode,
    rendered
  };
}
