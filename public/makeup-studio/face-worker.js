const base = new URL('./models/', self.location.href).href;
let detector;

async function initialize() {
  const {FilesetResolver, FaceLandmarker} = await import(base+'vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(base.slice(0,-1));
  return FaceLandmarker.createFromOptions(files, {
    baseOptions:{modelAssetPath:base+'face-landmarker.task',delegate:'CPU'},
    canvas:new OffscreenCanvas(1,1),
    runningMode:'IMAGE',numFaces:1,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,
  });
}

self.onmessage = async ({data:photo}) => {
  try {
    const model = await (detector ??= initialize());
    const scale = Math.min(1, 768 / Math.max(photo.width, photo.height));
    const input = new OffscreenCanvas(Math.round(photo.width*scale), Math.round(photo.height*scale));
    input.getContext('2d').drawImage(photo,0,0,input.width,input.height);
    self.postMessage({result:model.detect(input).faceLandmarks[0] || []});
  } catch (error) {
    self.postMessage({error:error.message || 'Face detection failed'});
  } finally { photo.close(); }
};
