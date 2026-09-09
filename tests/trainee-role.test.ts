import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isOfferedTraineeRole,
  TRAINEE_ROLES,
  TRAINEE_ROLES_OFFERED,
  TRAINEE_ROLE_LABELS,
  TRAINEE_ROLE_SHORT,
  traineeRoleAllowed,
  traineeRoleOptions,
} from "../src/lib/labels";

/**
 * The review form asks what somebody was doing at a facility, and offers three
 * answers: the internship year, summer training, volunteering.
 *
 * `TraineeRole` still holds seven, because dropping a value from a Postgres
 * enum means rebuilding the type and rewriting the column — a migration with
 * real risk and nothing to gain, since no review in production carries one.
 * The retired values therefore keep working everywhere except the menu.
 *
 * That split is the thing worth a test: a value that exists in the schema but
 * has no label renders as the bare word "Trainee" on every stamp that carries
 * it, which is a silent failure rather than a loud one.
 */

const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);

function enumValues(name: string): string[] {
  const block = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
  assert.ok(block, `enum ${name} is not in the schema`);
  return block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

test("every role the database can hold has both of its labels", () => {
  for (const value of enumValues("TraineeRole")) {
    assert.ok(
      TRAINEE_ROLE_LABELS[value],
      `${value} has no label — every stamp carrying it would read "Trainee"`,
    );
    assert.ok(TRAINEE_ROLE_SHORT[value], `${value} has no short label`);
  }
});

test("the labels do not invent roles the database cannot hold", () => {
  const known = new Set(enumValues("TraineeRole"));
  for (const value of TRAINEE_ROLES) {
    assert.ok(known.has(value), `${value} is labelled but not in the schema`);
  }
});

test("exactly three roles are offered, and all three are real", () => {
  assert.deepEqual([...TRAINEE_ROLES_OFFERED], [
    "INTERN",
    "SUMMER_TRAINEE",
    "VOLUNTEER",
  ]);

  const known = new Set(enumValues("TraineeRole"));
  for (const value of TRAINEE_ROLES_OFFERED) {
    assert.ok(known.has(value), `${value} is offered but not in the schema`);
  }
});

test("the retired roles are recognised, but not offered", () => {
  // They still have to render: the seed database uses them, and a review
  // carrying one must never fall back to the bare word "Trainee".
  for (const value of ["STUDENT", "RESIDENT", "FELLOW", "OBSERVER", "OTHER"]) {
    assert.ok(TRAINEE_ROLE_LABELS[value], `${value} lost its label`);
    assert.equal(
      isOfferedTraineeRole(value),
      false,
      `${value} is back on the menu`,
    );
  }
});

test("the offered roles lead the label maps, so the form lists them first", () => {
  assert.deepEqual(TRAINEE_ROLES.slice(0, 3), [...TRAINEE_ROLES_OFFERED]);
});

test("a new review may only be saved with one of the three", () => {
  for (const value of TRAINEE_ROLES_OFFERED) {
    assert.equal(traineeRoleAllowed(value), true);
  }
  for (const value of ["STUDENT", "RESIDENT", "FELLOW", "OBSERVER", "OTHER"]) {
    assert.equal(traineeRoleAllowed(value), false, `${value} was accepted`);
  }
  assert.equal(traineeRoleAllowed("PROFESSOR"), false);
});

test("editing a review keeps the answer it already carries", () => {
  // Fixing a typo in the body must not force a student rotation to be
  // restated as an internship year.
  assert.equal(traineeRoleAllowed("STUDENT", "STUDENT"), true);
  assert.equal(traineeRoleAllowed("INTERN", "STUDENT"), true);
  // But it does not open the door to a different retired value.
  assert.equal(traineeRoleAllowed("OBSERVER", "STUDENT"), false);
});

test("the menu grows by exactly one for an older review, and not otherwise", () => {
  assert.deepEqual([...traineeRoleOptions()], [...TRAINEE_ROLES_OFFERED]);
  assert.deepEqual([...traineeRoleOptions("INTERN")], [...TRAINEE_ROLES_OFFERED]);
  assert.deepEqual(
    [...traineeRoleOptions("STUDENT")],
    [...TRAINEE_ROLES_OFFERED, "STUDENT"],
  );
});
