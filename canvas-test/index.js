const fs = require('fs');
const { createCanvas, loadImage, ImageData } = require('canvas');
const { removeSeams } = require('../');

function go(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const newWidth = Math.floor(img.width/2);
  // const newWidth = Math.floor(img.width - 10);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const newData = removeSeams(imgData.data, canvas.width, canvas.height, img.width - newWidth);
  const newImgData = new ImageData(newData, newWidth, img.height);

  ctx.canvas.width = newWidth;
  ctx.putImageData(newImgData, 0, 0);
  return canvas;
}

const images = [
  "dog.png",
  "castle.png",
];

function bench(filename) {
  loadImage(filename).then((img) => {
    const runs = 5;
    const runTimes = new Array(runs);

    const canvas = go(img);
    fs.writeFileSync(`${filename}-out.png`, canvas.toBuffer('image/png'));

    for (let i = 0; i < runs; i++) {
      process.stdout.write(`\r\x1b[2K${i+1}/${runs}`);
      const start = process.hrtime.bigint();

      go(img);

      const elapsed = process.hrtime.bigint() - start;
      runTimes[i] = Number(elapsed / 1000000n);
    }

    const avg = runTimes.reduce((acc, val) => acc + val, 0) / runs;
    const min = Math.min.apply(null, runTimes);
    const max = Math.max.apply(null, runTimes);

    process.stdout.write('\r\x1b[2K');
    console.log(filename);
    console.log(`  min: ${min}ms`);
    console.log(`  max: ${max}ms`);
    console.log(`  avg: ${avg}ms\n`);
  });
}

images.forEach(bench);
