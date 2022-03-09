// index.js
// 获取应用实例

import * as paddlejs_core from '@paddlejs/paddlejs-core';
import '@paddlejs/paddlejs-backend-webgl';
const plugin = requirePlugin("paddlejs-plugin");
plugin.register(paddlejs_core, wx);

//let canvas_det = null;
//let canvas_rec = null;
let DETSHAPE = 960;
let RECWIDTH = 320;
const RECHEIGHT = 32;
let detectRunner = null;
let recRunner = null;

class OptModel extends paddlejs_core.Transformer {
  constructor() {
    super('OptModel');
  }
  transform(...args) {
    const [ops] = args;
    for (let opIndex = 0; opIndex < ops.length; opIndex++) {
      const op = ops[opIndex];
      if (op.type === 'pool2d' && op.attrs.pooling_type === 'avg') {
        op.type += '_avg';
      }
    }
  }
}

Page({
  data: {
    detWidth: 500,
    detHeight: 500,
    recWidth: 500,
    recHeight: 500
  },

  onLoad: function () {
    wx.getImageInfo({
      src: 'https://paddlepaddle-static.cdn.bcebos.com/paddle-cms-image/A4D0B510AF41483795188A6226FD63F6',
      success: res => {
        const image = res;
        this.paddle(image)
      }
    })
  },

  paddle: async function (image) {
    await this.init();
    const points = await this.detect(image);
  },

  init: async function (detCustomModel = null, recCustomModel = null) {
    const detModelPath = 'https://paddlejs.bj.bcebos.com/models/fuse/ocr/ch_PP-OCRv2_det_fuse_activation/model.json';
    const recModelPath = 'https://paddlejs.bj.bcebos.com/models/fuse/ocr/ch_PP-OCRv2_rec_fuse_activation/model.json';
    paddlejs_core.env.set('webgl_pack_output', true);
    //paddlejs_core.env.set('webgl_feed_process', true);
    //需要使用最新的paddlejs-core
    
    detectRunner = new paddlejs_core.Runner({
      modelPath: detCustomModel ? detCustomModel : detModelPath,
      fill: '#fff',
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
      bgr: true,
      webglFeedProcess: true
    });
    const detectInit = detectRunner.init();

    recRunner = new paddlejs_core.Runner({
      modelPath: recCustomModel ? recCustomModel : recModelPath,
      fill: '#000',
      mean: [0.5, 0.5, 0.5],
      std: [0.5, 0.5, 0.5],
      bgr: true,
      plugins: {
        preTransforms: [new OptModel()]
      },
      webglFeedProcess: true
    });
    const recInit = recRunner.init();

    await Promise.all([detectInit, recInit]);

    if (detectRunner.feedShape) {
      DETSHAPE = detectRunner.feedShape.fw;
    }
    if (recRunner.feedShape) {
      RECWIDTH = recRunner.feedShape.fw;
    }
    console.log('init finish')
  },

  detect: async function (image) {
    // 目标尺寸
    const targetWidth = DETSHAPE;
    const targetHeight = DETSHAPE;

    await new Promise((resolve, reject) => {
      this.setData({
        detWidth: targetWidth,
        detHeight: targetHeight
      }, () => resolve())
    })

    const ctx = wx.createCanvasContext('det')
    console.log(ctx)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, targetHeight, targetWidth);

    const imageWidth = image.width;
    const imageHeight = image.height;
    const imagePath = image.path
    // 缩放后的宽高
    let sw = targetWidth;
    let sh = targetHeight;
    let x = 0;
    let y = 0;
    // target的长宽比大些 就把原图的高变成target那么高
    if (targetWidth / targetHeight * imageHeight / imageWidth >= 1) {
      sw = Math.round(sh * imageWidth / imageHeight);
      x = Math.floor((targetWidth - sw) / 2);
    }
    // target的长宽比小些 就把原图的宽变成target那么宽
    else {
      sh = Math.round(sw * imageHeight / imageWidth);
      y = Math.floor((targetHeight - sh) / 2);
    }
    ctx.drawImage(imagePath, x, y, sw, sh);
    ctx.draw();
    const shapeList = [DETSHAPE, DETSHAPE];

    const canvasImage = await new Promise((resolve, reject) => {
      wx.canvasGetImageData({
        canvasId: 'det',
        x: 0,
        y: 0,
        width: targetWidth,
        height: targetHeight,
        success: res => resolve(res),
        fail: res => reject(res)
      })
    })

    var predictImage = {
      width: canvasImage.width,
      height: canvasImage.height,
      data: canvasImage.data.buffer
    }
    // const originalImage = await new Promise((resolve, reject) => {
    //   wx.getFileSystemManager().readFile({
    //     filePath: imagePath,
    //     success: res => resolve(res),
    //     fail: res => reject(res)
    //   })
    // })
    // var predictImage = {
    //   width: imageWidth,
    //   height: imageHeight,
    //   data: originalImage.data
    // }
    console.log(predictImage)

    //预测
    const outsDict = await detectRunner.predict(predictImage);

    return
  },

})
