import { defaultCharacters } from "./defaultCharacters.js";
import { AtlasType, RaceType, ClassType, WeaponType } from "./enums.js";

//#region variables
const baseUrl = "assets/Male/";
const rootSkeleton = "Root_Male/Root_Male.json";
const rootAtlas = "Root_Male/Root_Male.atlas.txt";

const raceAtlas = "Race/Male_Race.atlas.txt";
const classAtlas = "Class/Male_Class.atlas.txt";
const classForeHandAtlas = "Class_fore_hand/Male_Class_fore_hand.atlas.txt";
const eyesAtlas = "Eyes/Male_Eye.atlas.txt";
const hairAtlas = "Hair/Male_Hair.atlas.txt";
const weaponAtlas = "Weapon/Weapon.atlas.txt";

//character info
let character;
let characterId;
const defaultCharacter = {
  characterId: -1,
  race: RaceType.Human,
  class: ClassType.Knight,
  hair: 4,
  eye: 4,
  weapon: WeaponType.Greatsword,
  isFemale: false,
};

//spine vars
let assetManager;
let isLoadingAsset = false;
let animation = "Idle";
// let animation = "walk";
let skeletonJson, skeleton, skeletonData, skeletonMesh;
let lastFrameTime = Date.now() / 1000;
let onRenderFcts = [];
let lastTimeMsec = null;

//threejs vars
let geometry, material, mesh;
let scene, camera, renderer, canvas;

//arjs vars
let arToolkitSource, arToolkitContext, arMarkerControls, smoothedControls;
let markerRoot, smoothedRoot;
let rootAtlasLoader,
  raceAtlasLoader,
  classAtlasLoader,
  classForehandAtlasLoader,
  eyesAtlasLoader,
  hairAtlasLoader,
  weaponAtlasLoader;
//#endregion

//#region functions
window.onload = function () {
  try {
    var url_string = window.location.href.toLowerCase();
    var url = new URL(url_string);
    characterId = url.searchParams.get("characterId");
    if (!characterId || characterId == -1) {
      character = defaultCharacter;
      console.log("Default character!");
    } else {
      fetch(`https://dev-api.hellven.io/character/${characterId}`)
        .then((res) => {
          console.log("Get Character successfully!");
          if (res.data && res.data.id && res.data.id != -1) {
            character = res.data;
          } else {
            character = defaultCharacter;
          }
        })
        .catch((err) => {
          console.error("Something went wrong.", err);
          character = defaultCharacter;
        });
    }
  } catch (error) {
    console.log("Issues with Parsing URL Parameter's - " + error);
    character = defaultCharacter;
  }
};

async function loadAssets() {
  isLoadingAsset = true;
  try {
    assetManager = new spine.threejs.AssetManager(baseUrl);
    assetManager.loadText(rootSkeleton);
    assetManager.loadTextureAtlas(rootAtlas);
    assetManager.loadTextureAtlas(raceAtlas);
    assetManager.loadTextureAtlas(classAtlas);
    assetManager.loadTextureAtlas(classForeHandAtlas);
    assetManager.loadTextureAtlas(weaponAtlas);
    assetManager.loadTextureAtlas(eyesAtlas);
    assetManager.loadTextureAtlas(hairAtlas);

    await waitUntil(() => assetManager.isLoadingComplete());

    rootAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(rootAtlas));
    raceAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(raceAtlas));
    classAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(classAtlas));
    classForehandAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(classForeHandAtlas));
    eyesAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(eyesAtlas));
    hairAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(hairAtlas));
    weaponAtlasLoader = new spine.AtlasAttachmentLoader(assetManager.get(weaponAtlas));
  } catch (error) {
    console.error(error.message);
  } finally {
    isLoadingAsset = false;
  }
}

function initScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  scene = new THREE.Scene();

  // camera = new THREE.OrthographicCamera();
  camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
  // camera = new THREE.PerspectiveCamera(100, width / height, 1, 3000);
  camera.position.z = 100;
  // camera.position.y = 400;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color("lightgrey"), 0);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  renderer.domElement.style.left = "0px";

  markerRoot = new THREE.Group();
  smoothedRoot = new THREE.Group();
  scene.add(camera);
  scene.add(markerRoot);
  scene.add(smoothedRoot);

  canvas = renderer.domElement;
  document.body.appendChild(canvas);

  scene.visible = false;
}

function initArToolkit() {
  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: "webcam",
    sourceWidth: window.innerWidth,
    sourceHeight: window.innerHeight,
  });
  arToolkitSource.init(() => {
    setTimeout(() => {
      arToolkitSource.onResizeElement();
      arToolkitSource.copyElementSizeTo(renderer.domElement);
    }, 100);
    onResize();
  });
  window.addEventListener("resize", function () {
    onResize();
  });

  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: "../resources/camera_para.dat",
    detectionMode: "mono",
    maxDetectionRate: 60,
    // patternRatio: 0.5,
    // labelingMode: "black_region",
  });
  arToolkitContext.init(() => {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });

  onRenderFcts.push(function (delta) {
    smoothedControls.update(markerRoot);
  });
  onRenderFcts.push(function () {
    renderer.render(scene, camera);
  });
  onRenderFcts.push(function () {
    if (arToolkitSource == null) return;
    if (arToolkitSource.ready === false) return;
    arToolkitContext.update(arToolkitSource.domElement);
    scene.visible = camera.visible;
    if (camera.visible) {
      console.log("Marker detected!");
    }
  });

  arMarkerControls = new THREEx.ArMarkerControls(arToolkitContext, camera, {
    type: "pattern",
    patternUrl: "../resources/marker-test.patt",
    changeMatrixMode: "cameraTransformMatrix",
    smooth: true,
    smoothCount: 5,
    smoothTolerance: 0.01,
    smoothThreshold: 2,
  });

  smoothedControls = new THREEx.ArSmoothedControls(smoothedRoot, {
    lerpPosition: 0.4,
    lerpQuaternion: 0.3,
    lerpScale: 1,
  });
}

async function renderCharacter() {
  await waitUntil(() => assetManager.isLoadingComplete() && character != null);
  // const geometry = new THREE.BoxGeometry(1, 1, 1);
  // const material = new THREE.MeshNormalMaterial({
  //   transparent: true,
  //   opacity: 0.5,
  //   side: THREE.DoubleSide,
  //   // wireframe: true,
  // });
  // mesh = new THREE.Mesh(geometry, material);
  // mesh.position.y = geometry.parameters.height / 2;
  // mesh.rotateY(135);
  // mesh.rotateX(90);

  const arWorldRoot = smoothedRoot;
  skeletonJson = new spine.SkeletonJson(rootAtlasLoader);
  skeletonJson.scale = 0.001;
  skeletonData = skeletonJson.readSkeletonData(assetManager.get(rootSkeleton));
  skeleton = new spine.Skeleton(skeletonData);
  skeletonMesh = new spine.threejs.SkeletonMesh(skeletonData);

  skeletonMesh.state.setAnimation(0, animation, true);
  skeletonMesh.zOffset = 0.000001;
  // skeletonMesh.rotateX(-90);

  ChangeRaceRegion(RaceType.Human);
  ChangeClassRegion(ClassType.Knight);
  ChangeClassForeHandRegion(ClassType.Knight);
  ChangeEyesRegion(4);
  ChangeHairRegion(4);
  ChangeWeaponRegion(WeaponType.Greatsword);

  arWorldRoot.add(skeletonMesh);
  requestAnimationFrame(animate);
}

function animate(nowMsec) {
  requestAnimationFrame(animate);
  lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60;
  var deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
  lastTimeMsec = nowMsec;
  onRenderFcts.forEach(function (onRenderFct) {
    onRenderFct(deltaMsec / 1000, nowMsec / 1000);
  });
  skeletonMesh.update(deltaMsec / 1000);
  renderer.render(scene, camera);
}

function onResize() {
  arToolkitSource.onResizeElement();
  arToolkitSource.copyElementSizeTo(renderer.domElement);
  // if (arToolkitSource.arController !== null && arToolkitSource.arController.canvas != null) {
  //   arToolkitSource.copyElementSizeTo(arToolkitSource.arController.canvas);
  // }
}

//#endregion

//#region anim functions
function ChangeSkin(raceType, classType, eyeName, hairName, weaponType) {
  ChangeRaceRegion(raceType);
  ChangeClassRegion(classType);
  ChangeClassForeHandRegion(classType);
  ChangeEyesRegion(eyeName);
  ChangeHairRegion(hairName);
  ChangeWeaponRegion(weaponType);
  // UpdateSkeletonAnimation();
}

function ChangeWeaponRegion(weaponType) {
  SetSlotRegion(AtlasType.Weapon, "Weapon", "Weapon/" + weaponType);
}
function ChangeClassForeHandRegion(classType) {
  SetSlotRegion(AtlasType.ClassForeHand, "Class_fore_hand", "Class_fore_hand/M_" + classType + "_fore_hand");
}

function ChangeHairRegion(hairName) {
  SetSlotRegion(AtlasType.Hair, "B_Hair", "B_Hair/M_B_Hair_" + hairName);
  SetSlotRegion(AtlasType.Hair, "F_Hair", "F_Hair/M_F_Hair_" + hairName);
}
function ChangeEyesRegion(eyeName) {
  SetSlotRegion(AtlasType.Eyes, "Eyes", "Eyes/M_Eyes_" + eyeName);
}

function ChangeClassRegion(classType) {
  SetSlotRegion(AtlasType.Class, "Class_Body", "Class_Body/M_" + classType + "_Body");
  SetSlotRegion(AtlasType.Class, "Class_back_arm1", "Class_back_arm1/M_" + classType + "_back_arm1");
  SetSlotRegion(AtlasType.Class, "Class_back_arm2", "Class_back_arm2/M_" + classType + "_back_arm2");
  SetSlotRegion(AtlasType.Class, "Class_fore_arm1", "Class_fore_arm1/M_" + classType + "_fore_arm1");
  SetSlotRegion(AtlasType.Class, "Class_fore_arm2", "Class_fore_arm2/M_" + classType + "_fore_arm2");
  SetSlotRegion(AtlasType.Class, "Class_fore_coat", "Class_fore_coat/M_" + classType + "_fore_coat");
  SetSlotRegion(AtlasType.Class, "Class_fore_leg", "Class_fore_leg/M_" + classType + "_fore_leg");
  SetSlotRegion(AtlasType.Class, "Class_back_leg", "Class_back_leg/M_" + classType + "_back_leg");
  SetSlotRegion(AtlasType.Class, "Class_back_arm1", "Class_back_arm1/M_" + classType + "_back_arm1");
  SetSlotRegion(AtlasType.Class, "Class_back_arm2", "Class_back_arm2/M_" + classType + "_back_arm2");
  SetSlotRegion(AtlasType.Class, "Class_back_coat", "Class_back_coat/M_" + classType + "_back_coat");
}

function ChangeRaceRegion(raceType) {
  SetSlotRegion(AtlasType.Race, "Race_Body", "Body/M_" + raceType + "_Body");
  SetSlotRegion(AtlasType.Race, "Head", "Head/M_" + raceType + "_Head");
  SetSlotRegion(AtlasType.Race, "Race_fore_hand", "fore_hand/M_" + raceType + "_fore_hand");
  SetSlotRegion(AtlasType.Race, "Race_fore_arm1", "fore_arm1/M_" + raceType + "_fore_arm1");
  SetSlotRegion(AtlasType.Race, "Race_fore_arm2", "fore_arm2/M_" + raceType + "_fore_arm2");
  SetSlotRegion(AtlasType.Race, "Race_fore_leg", "fore_leg/M_" + raceType + "_fore_leg");
  SetSlotRegion(AtlasType.Race, "Race_back_leg", "back_leg/M_" + raceType + "_back_leg");
  SetSlotRegion(AtlasType.Race, "Race_back_arm1", "back_arm1/M_" + raceType + "_back_arm1");
  SetSlotRegion(AtlasType.Race, "Race_back_arm2", "back_arm2/M_" + raceType + "_back_arm2");
  SetSlotRegion(AtlasType.Race, "Race_back_hand", "back_hand/M_" + raceType + "_back_hand");
}

function GetAtlasRegion(type, name) {
  let atlasRegion = null;

  switch (type) {
    case AtlasType.Weapon:
      atlasRegion = weaponAtlasLoader.atlas.findRegion(name);
      break;
    case AtlasType.ClassForeHand:
      atlasRegion = classForehandAtlasLoader.atlas.findRegion(name);
      break;
    case AtlasType.Class:
      atlasRegion = classAtlasLoader.atlas.findRegion(name);
      break;
    case AtlasType.Race:
      atlasRegion = raceAtlasLoader.atlas.findRegion(name);
      break;
    case AtlasType.Eyes:
      atlasRegion = eyesAtlasLoader.atlas.findRegion(name);
      break;
    case AtlasType.Hair:
      atlasRegion = hairAtlasLoader.atlas.findRegion(name);
      break;
  }
  return atlasRegion;
}

function SetSlotRegion(atlatType, slotName, regionName) {
  const slot = skeleton.findSlot(slotName);
  if (slot == null) {
    console.error("Cannot find slot " + slotName);
    return;
  }
  const region = GetAtlasRegion(atlatType, regionName);
  if (region == null) {
    console.error("Cannot find region " + regionName);
    return;
  }
  // region.renderObject = region;
  // const attachment = slot.getAttachment();
  // var newAttachment = attachment.copy();
  // newAttachment.region = region;
  // attachment.updateUVs();
  // attachment.setRegion(region);
  // slot.setAttachment(attachment);
  // console.log("region", region);
  // slot.setAttachment(newAttachment);
  // console.log("attachment", slot.getAttachment());

  region.renderObject = region;
  const attachment = slot.getAttachment();
  var newAttachment = attachment.copy();
  newAttachment.region = region;
  slot.setAttachment(newAttachment);

  // slot.getAttachment().setRegion(region);
  // slot.attachment.updateOffset();
  // updateOffset();
  slot.setToSetupPose();
  // skeleton.setSlotsToSetupPose();
}
//#endregion

//#region utils
const waitUntil = (condition) => {
  return new Promise((resolve) => {
    let interval = setInterval(() => {
      if (!condition()) {
        return;
      }
      clearInterval(interval);
      resolve();
    }, 100);
  });
};
//#endregion

(async function () {
  initScene();
  initArToolkit();
  await loadAssets();
  await renderCharacter();
})();
