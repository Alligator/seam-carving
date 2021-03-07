export function findSeams(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  removeCount: number,
  onRemoveSeam?: (data: Uint8ClampedArray, width: number) => void,
): Uint8ClampedArray {
  let energySum = new Uint32Array(width * height);
  let remove = new Uint32Array(height);
  let energy = calcEnergy(data, width, height);
  let workingData = data.slice();

  for (let i = 0; i < removeCount; i++) {
    // populate the first row in energySum
    for (let j = 0; j < energy.length; j++) {
      energySum[j] = energy[j];
    }

    // populate the rest of the rows
    for (let y = 1; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const left = energySum[(y - 1) * width + Math.max(x - 1, 0)];
        const mid = energySum[(y - 1) * width + x];
        const right = energySum[(y - 1) * width + Math.min(x + 1, width - 1)];
        energySum[y * width + x] = energy[y * width + x] + Math.min(left, mid, right);
      }
    }

    // find the min on the last row
    let min = Infinity;
    let minx = 0;
    for (let x = 0; x < width; x++) {
      if (energySum[(height - 1) * width + x] < min) {
        min = energySum[(height - 1) * width + x];
        minx = x;
      }
    }

    remove[(height - 1)] = minx;

    // walk from the bottom up picking the min each time
    for (let y = height - 1; y >= 1; y--) {
      const leftx = Math.max(minx - 1, 0);
      const left = energySum[(y - 1) * width + leftx];

      const mid = energySum[(y - 1) * width + minx];

      const rightx = Math.min(minx + 1, width - 1);
      const right = energySum[(y - 1) * width + rightx];

      if (left < mid && left < right) {
        minx = leftx;
      } else if (right < mid && right < left) {
        minx = rightx;
      }

      remove[(y - 1)] = minx;
    }

    workingData = removeSeam(workingData, width, height, remove);
    energy = recalcEnergy(workingData, width - 1, height, energy, remove);
    width--;

    if (onRemoveSeam) {
      onRemoveSeam(workingData, width);
    }
  }

  return workingData;
}

// debug functions
// replace the return of findSeams to return energy or energySum instead
function dbgEnergy(energy: Uint32Array): Uint8ClampedArray {
  const newData = new Uint8ClampedArray(energy.length * 4);
  const buf32 = new Uint32Array(newData.buffer);

  for (let i = 0; i < energy.length; i++) {
    const nrg = energy[i];
    buf32[i] = 
      (0xff << 24) |
      (nrg <<  16) |
      (nrg <<   8) |
      nrg;
  }

  return newData;
}

function dbgEnergySum(ctx: CanvasRenderingContext2D, energySum: Uint32Array) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  let nrgMax = -Infinity;
  for (let i = 0; i < energySum.length; i++) {
    if (energySum[i] > nrgMax) {
      nrgMax = energySum[i];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      ctx.fillStyle = `hsl(0, 100%, ${(energySum[y * width + x + y] / nrgMax * 100).toFixed(2)}%`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// remove seams in remove from data, returning a new array.
// TODO mutate data instead of allocating a new array
function removeSeam(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  remove: Uint32Array,
): Uint8ClampedArray {
  const data32 = new Uint32Array(data.buffer);
  const newData = new Uint8ClampedArray((width - 1) * height * 4);
  const buf32 = new Uint32Array(newData.buffer);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    let removex = remove[y];
    for (let x = 0; x < width; x++) {
      if (x === removex) {
        // pixels been removed, skip over it
        offset++;
      }
      if (x < width) {
        buf32[y * (width - 1) + x] = data32[y * (width - 1) + x + offset];
      }
    }
  }

  return newData;
}

function diff(pixel1: number, pixel2: number): number {
  const r1 =  pixel1 & 0xff;
  const g1 = (pixel1 >> 8) & 0xff;
  const b1 = (pixel1 >> 16) & 0xff;

  const r2 =  pixel2 & 0xff;
  const g2 = (pixel2 >> 8) & 0xff;
  const b2 = (pixel2 >> 16) & 0xff;

  const rdiff = r1 - r2;
  const gdiff = g1 - g2;
  const bdiff = b1 - b2;

  const result = Math.sqrt(
    rdiff * rdiff +
    gdiff * gdiff +
    bdiff * bdiff
  );

  return result;
}

// calculate energy for the whole image
function calcEnergy(data: Uint8ClampedArray, width: number, height: number): Uint32Array {
  const buf32 = new Uint32Array(data.buffer);
  const energy = new Uint32Array(buf32.length);

  for (let i = 0; i < buf32.length; i++) {
    const x = i % width;
    const y = Math.floor(i / width);

    let hdiff;
    if (x === 0) {
      hdiff = diff(buf32[i], buf32[i + 1]);
    } else if (x == width - 1) {
      hdiff = diff(buf32[i - 1], buf32[i]);
    } else {
      hdiff = diff(buf32[i - 1], buf32[i + 1]);
    }

    let vdiff;
    if (y === 0) {
      vdiff = diff(buf32[i], buf32[i + width]);
    } else if (y === height - 1) {
      vdiff = diff(buf32[i - width], buf32[i]);
    } else {
      vdiff = diff(buf32[i - width], buf32[i + width]);
    }

    energy[i] = hdiff + vdiff;
  }

  return energy;
}

// calculate energy for the whole image, but recalculate pixels around the seam
// in removed and handle removing the seam from energy.
function recalcEnergy(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  energy: Uint32Array,
  removed: Uint32Array,
): Uint32Array {
  const buf32 = new Uint32Array(data.buffer);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    let removex = removed[y];
    for (let x = 0; x < width; x++) {
      if (x === removex) {
        // pixels been removed, skip over it
        offset++;
      }

      let nrg = energy[y * width + x + offset];
      if (x >= removex - 1 && x <= removex) {
        if (x === 0 || x === width - 1 || y === 0) {
          // border pixels
          nrg = nrg;
        } else {
          const hdiff = diff(buf32[y * width + x - 1], buf32[y * width + x + 1]);
          const vdiff = diff(buf32[(y - 1) * width + x], buf32[(y + 1) * width + x]);
          nrg = hdiff + vdiff;
        }
      }
      energy[y * width + x] = nrg;
    }

    if (removex >= width) {
      // case where a pixel on the removed edge is gone
      offset++;
    }
  }

  return energy;
}

