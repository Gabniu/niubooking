import { test } from "node:test";
import assert from "node:assert/strict";
import { findRequirementAvailability, validateRequirementAssignments } from "./requirement-availability.js";

const window = { from: new Date("2026-08-14T09:00:00Z"), to: new Date("2026-08-14T11:00:00Z"), durationMinutes: 60, stepMinutes: 60 };
const requirements = [{ id: "instructor", quantity: 1, resourceType: null, capabilityKey: "driving.instructor" }, { id: "vehicle", quantity: 1, resourceType: "vehicle", capabilityKey: null }];
const resources = [{ id: "staff-1", resourceType: "staff", capabilities: ["driving.instructor"] }, { id: "car-1", resourceType: "vehicle", capabilities: [] }];

test("keeps requirement labels available for a human booking summary", () => {
  const result = findRequirementAvailability(requirements.map((requirement) => ({ ...requirement, label: requirement.id === "instructor" ? "Instructor" : "Vehicle" })), resources, [], window);
  assert.deepEqual(result.slots[0]?.assignments.map((assignment) => assignment.requirementLabel), ["Instructor", "Vehicle"]);
});

test("matches every active requirement without reusing a resource", () => {
  const result = findRequirementAvailability(requirements, resources, [], window);
  assert.equal(result.slots.length, 2);
  assert.deepEqual(result.slots[0]?.assignments.map((assignment) => assignment.resourceIds[0]), ["staff-1", "car-1"]);
});

test("explains an occupied compatible resource", () => {
  const occupiedWindow = { ...window, to: new Date("2026-08-14T10:00:00Z") };
  const result = findRequirementAvailability(requirements, resources, [{ resourceId: "car-1", startsAt: window.from, endsAt: occupiedWindow.to, status: "scheduled" }], occupiedWindow);
  assert.equal(result.slots.length, 0);
  assert.deepEqual(result.rejected, [{ requirementId: "vehicle", reason: "INSUFFICIENT_RESOURCES" }]);
});

test("validates typed assignments before confirmation", () => {
  const errors = validateRequirementAssignments(requirements.map((requirement) => ({ ...requirement, status: "active" as const })), resources, [{ requirementId: "instructor", resourceIds: ["car-1"] }, { requirementId: "vehicle", resourceIds: ["car-1"] }]);
  assert.match(errors.join("; "), /does not satisfy|assigned more than once/iu);
});
