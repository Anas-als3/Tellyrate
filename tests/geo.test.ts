import assert from "node:assert/strict";
import test from "node:test";
import { pointInBoundary } from "../src/lib/geo";

const squareWithHole = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ],
  ],
};

test("pointInBoundary handles shells, holes and boundary points", () => {
  assert.equal(pointInBoundary(2, 2, squareWithHole), true);
  assert.equal(pointInBoundary(5, 5, squareWithHole), false);
  assert.equal(pointInBoundary(12, 2, squareWithHole), false);
  assert.equal(pointInBoundary(0, 5, squareWithHole), true);
});

test("pointInBoundary checks every polygon in a multipolygon", () => {
  const geometry = {
    type: "MultiPolygon" as const,
    coordinates: [
      squareWithHole.coordinates,
      [
        [
          [20, 20],
          [21, 20],
          [21, 21],
          [20, 21],
          [20, 20],
        ],
      ],
    ],
  };

  assert.equal(pointInBoundary(20.5, 20.5, geometry), true);
  assert.equal(pointInBoundary(15, 15, geometry), false);
});
