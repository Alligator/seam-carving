"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeSeams = void 0;
function removeSeams(data, width, height, removeCount, onRemoveSeam) {
    let energySum = new Uint32Array(width * height);
    let remove = new Uint32Array(height);
    let energy = calcEnergy(data, width, height);
    let workingData = data.slice();
    for (let i = 0; i < removeCount; i++) {
        calcEnergySum(energySum, energy, width, height);
        findMinSeam(remove, energySum, width, height);
        workingData = removeSeam(workingData, width, height, remove);
        energy = recalcEnergy(workingData, width - 1, height, energy, remove);
        width--;
        if (onRemoveSeam) {
            onRemoveSeam(workingData, width);
        }
    }
    workingData = workingData.slice(0, width * height * 4);
    return workingData;
}
exports.removeSeams = removeSeams;
// filthy branchless max and min
// if x - y is positive, (x - y) >> 31 will be all 0s
// if x - y is negative, (x - y) >> 31 will be all 1s
// & that with x - y to either get 0 or x - y
function fastMin(x, y) {
    return y + ((x - y) & ((x - y) >> 31));
}
function fastMax(x, y) {
    return x - ((x - y) & ((x - y) >> 31));
}
// remove seams in remove from data, returning a new array.
function removeSeam(data, width, height, remove) {
    const data32 = new Uint32Array(data.buffer);
    let offset = 0;
    for (let y = 0; y < height; y++) {
        let removex = remove[y];
        // copy left half
        data32.copyWithin(y * (width - 1), y * (width - 1) + offset, y * (width - 1) + offset + removex);
        // skip removex
        offset++;
        // copy right half
        data32.copyWithin(y * (width - 1) + removex, y * (width - 1) + offset + removex, y * (width - 1) + (width - 1) + offset);
    }
    return data;
}
function diff(pixel1, pixel2) {
    const r1 = pixel1 & 0xff;
    const g1 = (pixel1 >> 8) & 0xff;
    const b1 = (pixel1 >> 16) & 0xff;
    const r2 = pixel2 & 0xff;
    const g2 = (pixel2 >> 8) & 0xff;
    const b2 = (pixel2 >> 16) & 0xff;
    const rdiff = r1 - r2;
    const gdiff = g1 - g2;
    const bdiff = b1 - b2;
    const result = Math.sqrt(rdiff * rdiff +
        gdiff * gdiff +
        bdiff * bdiff);
    return result;
}
// calculate energy for the whole image
function calcEnergy(data, width, height) {
    const buf32 = new Uint32Array(data.buffer);
    const energy = new Uint32Array(buf32.length);
    for (let i = 0; i < buf32.length; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        let hdiff;
        if (x === 0) {
            hdiff = diff(buf32[i], buf32[i + 1]);
        }
        else if (x == width - 1) {
            hdiff = diff(buf32[i - 1], buf32[i]);
        }
        else {
            hdiff = diff(buf32[i - 1], buf32[i + 1]);
        }
        let vdiff;
        if (y === 0) {
            vdiff = diff(buf32[i], buf32[i + width]);
        }
        else if (y === height - 1) {
            vdiff = diff(buf32[i - width], buf32[i]);
        }
        else {
            vdiff = diff(buf32[i - width], buf32[i + width]);
        }
        energy[i] = hdiff + vdiff;
    }
    return energy;
}
// calculate energy for the whole image, but recalculate pixels around the seam
// in removed and handle removing the seam from energy.
function recalcEnergy(data, width, height, energy, removed) {
    const buf32 = new Uint32Array(data.buffer);
    let offset = 0;
    for (let y = 0; y < height; y++) {
        let removex = removed[y];
        // copy left half
        energy.copyWithin(y * width, y * width + offset, y * width + offset + removex - 1);
        // skip removex
        offset++;
        // copy right half
        energy.copyWithin(y * width + removex + 1, y * width + offset + removex + 1, y * width + offset + width);
        // recalc pixels around seam
        for (let x = removex - 1; x <= removex; x++) {
            let nrg = energy[y * width + x + offset];
            if (x === 0 || x === width - 1 || y === 0) {
                // border pixels
                nrg = nrg;
            }
            else {
                const hdiff = diff(buf32[y * width + x - 1], buf32[y * width + x + 1]);
                const vdiff = diff(buf32[(y - 1) * width + x], buf32[(y + 1) * width + x]);
                nrg = hdiff + vdiff;
            }
            energy[y * width + x] = nrg;
        }
    }
    return energy;
}
function calcEnergySum(energySum, energy, width, height) {
    // populate the first row in energySum
    for (let j = 0; j < width; j++) {
        energySum[j] = energy[j];
    }
    // populate the rest of the rows
    for (let y = 1; y < height; y++) {
        let x = 0;
        // left edge
        const lmid = energySum[(y - 1) * width + x];
        const lright = energySum[(y - 1) * width + x + 1];
        energySum[y * width + x] = energy[y * width + x] + fastMin(lmid, lright);
        for (x = 1; x < width - 1; x++) {
            const prev = energy[y * width + x];
            const index = (y - 1) * width + x - 1;
            const left = energySum[index];
            const mid = energySum[index + 1];
            const right = energySum[index + 2];
            energySum[y * width + x] = prev + fastMin(fastMin(left, mid), right);
        }
        // right edge
        const rleft = energySum[(y - 1) * width + x - 1];
        const rmid = energySum[(y - 1) * width + x];
        energySum[y * width + x] = energy[y * width + x] + fastMin(rleft, rmid);
    }
}
function findMinSeam(remove, energySum, width, height) {
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
        const leftx = fastMax(minx - 1, 0);
        const left = energySum[(y - 1) * width + leftx];
        const mid = energySum[(y - 1) * width + minx];
        const rightx = fastMin(minx + 1, width - 1);
        const right = energySum[(y - 1) * width + rightx];
        if (left < mid && left < right) {
            minx = leftx;
        }
        else if (right < mid && right < left) {
            minx = rightx;
        }
        remove[(y - 1)] = minx;
    }
}
// debug functions
// replace the return of findSeams to return energy or energySum instead
function dbgEnergy(energy) {
    const newData = new Uint8ClampedArray(energy.length * 4);
    const buf32 = new Uint32Array(newData.buffer);
    for (let i = 0; i < energy.length; i++) {
        const nrg = energy[i];
        buf32[i] =
            (0xff << 24) |
                (nrg << 16) |
                (nrg << 8) |
                nrg;
    }
    return newData;
}
function dbgEnergySum(energySum) {
    const newData = new Uint8ClampedArray(energySum.length * 4);
    const buf32 = new Uint32Array(newData.buffer);
    let nrgMax = -Infinity;
    for (let i = 0; i < energySum.length; i++) {
        if (energySum[i] > nrgMax) {
            nrgMax = energySum[i];
        }
    }
    for (let i = 0; i < energySum.length; i++) {
        const nrg = (energySum[i] / nrgMax) * 255;
        buf32[i] =
            (0xff << 24) |
                (nrg << 16) |
                (nrg << 8) |
                nrg;
    }
    return newData;
}
