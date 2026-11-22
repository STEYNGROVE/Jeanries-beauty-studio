const fs = require('node:fs');
const { onnx } = require('onnx-proto');
const model = onnx.ModelProto.decode(fs.readFileSync(process.argv[2]));
const unpack = [];
for (const tensor of model.graph.initializer.slice()) {
  if (tensor.dataType !== 1 || tensor.dims.length !== 4 || tensor.rawData.length < 4096) continue;
  const name = tensor.name;
  const channels = Number(tensor.dims[0]);
  const data = Buffer.from(tensor.rawData);
  const stride = data.length / 4 / channels;
  const weights = new Int8Array(stride * channels);
  const scales = Buffer.alloc(channels * 4);

  // Symmetric, per-channel weight quantization. ONNX Runtime folds the
  // constant unpacking operations during session initialization.
  for (let channel = 0; channel < channels; channel++) {
    const start = channel * stride;
    let peak = 0;
    for (let i = start; i < start + stride; i++) {
      peak = Math.max(peak, Math.abs(data.readFloatLE(i * 4)));
    }
    const scale = peak / 127 || 1;
    scales.writeFloatLE(scale, channel * 4);
    for (let i = start; i < start + stride; i++) {
      weights[i] = Math.round(data.readFloatLE(i * 4) / scale);
    }
  }

  tensor.name = name + '__int8';
  tensor.dataType = 3;
  tensor.rawData = Buffer.from(weights.buffer);
  const scaleName = name + '__scales';
  const unpackedName = name + '__unpacked';
  model.graph.initializer.push(onnx.TensorProto.create({
    name: scaleName, dims: [channels, 1, 1, 1], dataType: 1, rawData: scales,
  }));
  unpack.push(onnx.NodeProto.create({
    opType: 'Cast', input: [tensor.name], output: [unpackedName],
    attribute: [{name: 'to', type: 2, i: 1}],
  }), onnx.NodeProto.create({
    opType: 'Mul', input: [unpackedName, scaleName], output: [name],
  }));
}
model.graph.node.unshift(...unpack);
fs.writeFileSync(process.argv[3], onnx.ModelProto.encode(model).finish());
