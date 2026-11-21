const fs = require('node:fs');
const { onnx } = require('onnx-proto');
const model = onnx.ModelProto.decode(fs.readFileSync(process.argv[2]));
const casts = [];
for (const tensor of model.graph.initializer) {
  if (tensor.dataType !== 1 || tensor.rawData.length < 1024) continue;
  const original = tensor.name;
  const source = Buffer.from(tensor.rawData);
  const values = new Float16Array(source.length / 4);
  for (let i = 0; i < values.length; i++) values[i] = source.readFloatLE(i * 4);
  tensor.name = original + '__half';
  tensor.dataType = 10;
  tensor.rawData = Buffer.from(values.buffer);
  casts.push(onnx.NodeProto.create({
    name: tensor.name + '_cast',
    opType: 'Cast',
    input: [tensor.name],
    output: [original],
    attribute: [{name:'to',type:2,i:1}],
  }));
}
model.graph.node.unshift(...casts);
fs.writeFileSync(process.argv[3], onnx.ModelProto.encode(model).finish());
