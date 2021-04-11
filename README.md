# JavaScript Seam Carving

A reasonably fast seam carving implementation in pure JavaScript with no dependencies.

## Usage

Only one function is exported:
```typescript
export function removeSeams(
  // the image data, expected to be the return value from a getImageData call
  data: Uint8ClampedArray,
  // the width of the image
  width: number,
  // the height of the image
  height: number,
  // the number of seams to remove
  removeCount: number,
  // an optional callback, called with new image data and the current width whenever a seam is removed
  onRemoveSeam?: (data: Uint8ClampedArray, width: number) => void,
): Uint8ClampedArray {
```

Example usage, where `canvas` is a canvas element and `ctx` is a `CanvasRenderingContext2D`:

```javascript
const seamsToRemove = 100;

// get image data from the canvas
const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// remove seams
const newData = removeSeams(imgData.data, canvas.width, canvas.height, seamsToRemove);

// create a new ImageData object containing the resized image
const newImgData = new ImageData(newData, canvas.width - seamsToRemove, img.height);

// resize the canvas and draw the resized image
ctx.canvas.width -= seamsToRemove;
ctx.putImageData(newImgData, 0, 0);
```

## Benchmarks

Taken on an M1 MacBook Pro, reducing the width of two images in half:

image size | seams removed | time taken | seams per second
-----------|---------------|------------|-----------------
800 x 524  | 400           | 348ms      | 1149
1428 x 968 | 714           | 1977ms     | 361

## Implementation

It uses a standard seam carving algorithm. Here's an overview:

```
calculate the energy of each pixel
for each seam to remove:
    find the lowest energy seam
    remove it from the image
    recalculate the energy of the pixels around the seam
```

I do the following to make it quick and keep memory usage low:

**Use pre-allocated typed arrays everywhere.** Arrays are pre-allocated outside the main loop and functions mutate them to avoid allocation.

**Use `Array.copyWithin`.** This shifts data around inside an array much faster than a loop.

**Use branchless replacements for `Math.max` and `Math.min`.** Max and min are used multiple times in the hottest loop in the library. Replacing these with branchless versions offered a significant speed up (30% on my Intel PC, 50% on my ARM Mac).