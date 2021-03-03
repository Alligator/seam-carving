import * as fs from 'fs';
import { createCanvas, Image, ImageData } from 'canvas';
import { findSeams } from './index';

function go() {
  console.log('running...');
  const img = new Image();
  img.src = 'castle.jpg';

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const newWidth = Math.floor(img.width/2);
  // const newWidth = img.width;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const newData = findSeams(imgData.data, canvas.width, canvas.height, img.width - newWidth);
  const newImgData = new ImageData(newData, newWidth, img.height);

  ctx.canvas.width = Math.floor(newWidth);
  ctx.putImageData(newImgData, 0, 0);

  fs.writeFileSync('output.jpg', canvas.toBuffer('image/jpeg'));
}

console.time('total');
go();
console.timeEnd('total');
