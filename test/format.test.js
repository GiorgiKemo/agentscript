import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatLayoutSource, formatStyleSource } from "../src/compiler/format.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(currentDir, "..");

test("formatLayoutSource produces canonical layout formatting", () => {
  const source = `page Demo
state note "Hello world"
state count 0
hero intro {
text pitch "Hi"
field note_input from note
row actions {
button go "Go"
}
}
when input note_input {
if note is "Hello world" {
set note to "Changed"
} else {
reset note
}
}`;

  const formatted = formatLayoutSource(source);

  assert.equal(
    formatted,
    `page Demo

state note "Hello world"
state count 0

hero intro {
  text pitch "Hi"
  field note_input from note
  row actions {
    button go "Go"
  }
}

when input note_input {
  if note is "Hello world" {
    set note to "Changed"
  } else {
    reset note
  }
}
`
  );
});

test("formatLayoutSource supports app and page blocks", () => {
  const source = `app Demo
start page home
state note "Ready"
create page home {
button open_about "About"
}
create page about {
text note_text from note
}
when click open_about {
go to page about
}`;

  const formatted = formatLayoutSource(source);

  assert.equal(
    formatted,
    `app Demo

start page home

state note "Ready"

create page home {
  button open_about "About"
}

create page about {
  text note_text from note
}

when click open_about {
  go to page about
}
`
  );
});

test("formatLayoutSource supports reusable blocks and boolean states", () => {
  const source = `app Demo
state ready true
create block stat_card {
section shell {
text label "Ready"
text value from ready
}
}
create page home {
use block stat_card as primary_card
}
`;

  const formatted = formatLayoutSource(source);

  assert.equal(
    formatted,
    `app Demo

state ready true

create block stat_card {
  section shell {
    text label "Ready"
    text value from ready
  }
}

create page home {
  use block stat_card as primary_card
}
`
  );
});

test("formatStyleSource produces canonical style formatting", () => {
  const source = `select note_input {
fill white
text color #17335b
}
select actions {
line up
space 16px
center
}`;

  const formatted = formatStyleSource(source);

  assert.equal(
    formatted,
    `select note_input {
  fill white
  text color #17335b
}

select actions {
  line up
  space 16px
  center
}
`
  );
});

test("formatter is idempotent for the example sources", () => {
  const layoutSource = fs.readFileSync(path.join(workspaceDir, "examples", "home.agent"), "utf8");
  const styleSource = fs.readFileSync(path.join(workspaceDir, "examples", "home.style"), "utf8");

  const formattedLayout = formatLayoutSource(layoutSource);
  const formattedStyle = formatStyleSource(styleSource);

  assert.equal(formatLayoutSource(formattedLayout), formattedLayout);
  assert.equal(formatStyleSource(formattedStyle), formattedStyle);
});
