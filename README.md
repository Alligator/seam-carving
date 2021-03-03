# JavaScript Seam Carving

I wanted a faster implementation of seam carving in JS, so here it is. Currently doesn't do anything clever, just tries to avoid unnecessary looping or allocation. See `canvas-test.ts` for an example using node-canvas.

## Usage

Only one function is exported:
```typescript
export function findSeams(
  // the data to use. expected to be the return value from a canvas ctx.getImageData call
  data: Uint8ClampedArray,
  // the width of the image data
  width: number,
  // the height of the image data
  height: number,
  // the number of seams to remove
  removeCount: number,
  // an optional callback, called with new image data and the current width whenever a seam is removed
  onRemoveSeam?: (data: Uint8ClampedArray, width: number) => void,
): Uint8ClampedArray {
```
