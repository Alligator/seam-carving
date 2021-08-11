import { createCanvas, loadImage, Image, ImageData, CanvasRenderingContext2D } from 'canvas';
import { readdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import {exec } from 'child_process';
import { removeSeams } from '../';

const imagePromises = readdirSync('images')
  .filter((file) => file.endsWith('.png'))
  .map((file) => loadImage(path.join('images', file)));

function reduceImage(imgData: ImageData, seamsToRemove: number): ImageData {
  const desiredWidth = imgData.width - seamsToRemove;
  const newData = removeSeams(imgData.data, imgData.width, imgData.height, seamsToRemove);
  return new ImageData(newData, desiredWidth, imgData.height);
}

function showFile(path: string) {
  let openCmd = 'xdg-open';
  switch (process.platform) {
    case 'darwin': {
      openCmd = 'open';
      break;
    }
    case 'win32': {
      openCmd = 'start';
      break;
    }
  }

  exec(`${openCmd} "${path}"`);
}

Promise.all(imagePromises).then((images) => {
  const longestWidth = images.reduce((acc, val) => Math.max(acc, val.width), 0);
  const totalHeight = images.reduce((acc, val) => acc + val.height, 0);
  const margin = 10;

  const canvas = createCanvas(longestWidth * 3, totalHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentY = 0;
  images.forEach((image) => {
    console.log(image.src);
    const imgCanvas = createCanvas(image.width, image.height);
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.drawImage(image, 0, 0);
    const imgData = imgCtx.getImageData(0, 0, image.width, image.height);

    let currentOffset = margin;
    { // reduce by 1/4
      const seamsToRemove = Math.floor(image.width / 4);
      const newImgData = reduceImage(imgData, seamsToRemove);
      ctx.putImageData(newImgData, longestWidth + currentOffset, currentY);
      currentOffset += newImgData.width + margin;
    }

    { // reduce by half
      const seamsToRemove = Math.floor(image.width / 2);
      const newImgData = reduceImage(imgData, seamsToRemove);
      ctx.putImageData(newImgData, longestWidth + currentOffset, currentY);
      currentOffset += newImgData.width + margin;
    }

    ctx.drawImage(image, longestWidth - image.width, currentY);
    currentY += image.height;
  });

  writeFileSync('output.png', canvas.toBuffer());
  showFile('output.png');
});
