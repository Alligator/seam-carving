"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSeams = void 0;
function findSeams(data, width, height, removeCount) {
    var energySum = new Uint32Array(width * height);
    var remove = new Uint32Array(height);
    var energy = calcEnergy(data, width, height);
    var workingData = data.slice();
    for (var i = 0; i < removeCount; i++) {
        // populate the first row in energySum
        for (var j = 0; j < energy.length; j++) {
            energySum[j] = energy[j];
        }
        // populate the rest of the rows
        for (var y = 1; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var left = energySum[(y - 1) * width + Math.max(x - 1, 0)];
                var mid = energySum[(y - 1) * width + x];
                var right = energySum[(y - 1) * width + Math.min(x + 1, width - 1)];
                energySum[y * width + x] = energy[y * width + x] + Math.min(left, mid, right);
            }
        }
        // find the min on the last row
        var min = Infinity;
        var minx = 0;
        for (var x = 0; x < width; x++) {
            if (energySum[(height - 1) * width + x] < min) {
                min = energySum[(height - 1) * width + x];
                minx = x;
            }
        }
        remove[(height - 1)] = minx;
        // walk from the bottom up picking the min each time
        for (var y = height - 1; y >= 1; y--) {
            var leftx = Math.max(minx - 1, 0);
            var left = energySum[(y - 1) * width + leftx];
            var mid = energySum[(y - 1) * width + minx];
            var rightx = Math.min(minx + 1, width - 1);
            var right = energySum[(y - 1) * width + rightx];
            if (left < mid && left < right) {
                minx = leftx;
            }
            else if (right < mid && right < left) {
                minx = rightx;
            }
            remove[(y - 1)] = minx;
        }
        workingData = removeSeam(workingData, width, height, remove);
        energy = recalcEnergy(workingData, width - 1, height, energy, remove);
        width--;
    }
    return workingData;
}
exports.findSeams = findSeams;
// debug functions
// replace the return of findSeams to return energy or energySum instead
function dbgEnergy(energy) {
    var newData = new Uint8ClampedArray(energy.length * 4);
    var buf32 = new Uint32Array(newData.buffer);
    for (var i = 0; i < energy.length; i++) {
        var nrg = energy[i];
        buf32[i] =
            (0xff << 24) |
                (nrg << 16) |
                (nrg << 8) |
                nrg;
    }
    return newData;
}
function dbgEnergySum(ctx, energySum) {
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    var nrgMax = -Infinity;
    for (var i = 0; i < energySum.length; i++) {
        if (energySum[i] > nrgMax) {
            nrgMax = energySum[i];
        }
    }
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width - 1; x++) {
            ctx.fillStyle = "hsl(0, 100%, " + (energySum[y * width + x + y] / nrgMax * 100).toFixed(2) + "%";
            ctx.fillRect(x, y, 1, 1);
        }
    }
}
// remove seams in remove from data, returning a new array.
// TODO mutate data instead of allocating a new array
function removeSeam(data, width, height, remove) {
    var data32 = new Uint32Array(data.buffer);
    var newData = new Uint8ClampedArray((width - 1) * height * 4);
    var buf32 = new Uint32Array(newData.buffer);
    var offset = 0;
    for (var y = 0; y < height; y++) {
        var removex = remove[y];
        for (var x = 0; x < width; x++) {
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
function diff(pixel1, pixel2) {
    var r1 = pixel1 & 0xff;
    var g1 = (pixel1 >> 8) & 0xff;
    var b1 = (pixel1 >> 16) & 0xff;
    var r2 = pixel2 & 0xff;
    var g2 = (pixel2 >> 8) & 0xff;
    var b2 = (pixel2 >> 16) & 0xff;
    var rdiff = r1 - r2;
    var gdiff = g1 - g2;
    var bdiff = b1 - b2;
    var result = Math.sqrt(rdiff * rdiff +
        gdiff * gdiff +
        bdiff * bdiff);
    return result;
}
// calculate energy for the whole image
function calcEnergy(data, width, height) {
    var buf32 = new Uint32Array(data.buffer);
    var energy = new Uint32Array(buf32.length);
    for (var i = 0; i < buf32.length; i++) {
        var x = i % width;
        var y = Math.floor(i / width);
        if (x === 0 || x === width - 1 || y === 0) {
            // border pixels
            energy[i] = 100;
            continue;
        }
        var hdiff = diff(buf32[i - 1], buf32[i + 1]);
        var vdiff = diff(buf32[i - width], buf32[i + width]);
        energy[i] = hdiff + vdiff;
    }
    return energy;
}
// calculate energy for the whole image, but recalculate pixels around the seam
// in removed and handle removing the seam from energy.
function recalcEnergy(data, width, height, energy, removed) {
    var buf32 = new Uint32Array(data.buffer);
    var offset = 0;
    for (var y = 0; y < height; y++) {
        var removex = removed[y];
        for (var x = 0; x < width; x++) {
            if (x === removex) {
                // pixels been removed, skip over it
                offset++;
            }
            var nrg = energy[y * width + x + offset];
            if (x >= removex - 1 && x <= removex) {
                if (x === 0 || x === width - 1 || y === 0) {
                    // border pixels
                    nrg = nrg;
                }
                else {
                    var hdiff = diff(buf32[y * width + x - 1], buf32[y * width + x + 1]);
                    var vdiff = diff(buf32[(y - 1) * width + x], buf32[(y + 1) * width + x]);
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
