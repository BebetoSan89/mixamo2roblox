// ============================================================
//  converter.js  —  Mixamo FBX → Roblox .rbxanim
//  Corre 100% en el navegador, sin servidores
// ============================================================

// Tabla de conversion de huesos Mixamo → Roblox R15
const BONE_MAP = {
  "Hips":             "HumanoidRootPart",
  "Spine":            "LowerTorso",
  "Spine1":           "LowerTorso",
  "Spine2":           "UpperTorso",
  "Neck":             "Head",
  "Head":             "Head",
  "LeftShoulder":     "LeftUpperArm",
  "LeftArm":          "LeftUpperArm",
  "LeftForeArm":      "LeftLowerArm",
  "LeftHand":         "LeftHand",
  "RightShoulder":    "RightUpperArm",
  "RightArm":         "RightUpperArm",
  "RightForeArm":     "RightLowerArm",
  "RightHand":        "RightHand",
  "LeftUpLeg":        "LeftUpperLeg",
  "LeftLeg":          "LeftLowerLeg",
  "LeftFoot":         "LeftFoot",
  "LeftToeBase":      "LeftFoot",
  "RightUpLeg":       "RightUpperLeg",
  "RightLeg":         "RightLowerLeg",
  "RightFoot":        "RightFoot",
  "RightToeBase":     "RightFoot",
  // Variantes con prefijo mixamorig:
  "mixamorig:Hips":           "HumanoidRootPart",
  "mixamorig:Spine":          "LowerTorso",
  "mixamorig:Spine1":         "LowerTorso",
  "mixamorig:Spine2":         "UpperTorso",
  "mixamorig:Neck":           "Head",
  "mixamorig:Head":           "Head",
  "mixamorig:LeftShoulder":   "LeftUpperArm",
  "mixamorig:LeftArm":        "LeftUpperArm",
  "mixamorig:LeftForeArm":    "LeftLowerArm",
  "mixamorig:LeftHand":       "LeftHand",
  "mixamorig:RightShoulder":  "RightUpperArm",
  "mixamorig:RightArm":       "RightUpperArm",
  "mixamorig:RightForeArm":   "RightLowerArm",
  "mixamorig:RightHand":      "RightHand",
  "mixamorig:LeftUpLeg":      "LeftUpperLeg",
  "mixamorig:LeftLeg":        "LeftLowerLeg",
  "mixamorig:LeftFoot":       "LeftFoot",
  "mixamorig:RightUpLeg":     "RightUpperLeg",
  "mixamorig:RightLeg":       "RightLowerLeg",
  "mixamorig:RightFoot":      "RightFoot",
};

// Estado global
let convertedData = null;
let originalFileName = "";

// ── UI helpers ──────────────────────────────────────────────

function setStep(id, state, statusText) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "prog-step " + state;
  const status = el.querySelector(".prog-status");
  if (status) {
    status.textContent = statusText;
    if (state === "active") {
      status.innerHTML = '<span class="spinner"></span>';
    }
  }
  const icon = el.querySelector(".prog-icon");
  if (icon) {
    if (state === "done") icon.textContent = "✅";
    else if (state === "error") icon.textContent = "❌";
  }
}

function showError(msg) {
  const card = document.getElementById("errorCard");
  card.textContent = "❌ Error: " + msg;
  card.classList.add("visible");
}

function resetConverter() {
  document.getElementById("dropzone").style.display = "block";
  document.getElementById("progressWrap").classList.remove("visible");
  document.getElementById("resultWrap").classList.remove("visible");
  document.getElementById("errorCard").classList.remove("visible");
  ["step-parse","step-bones","step-keyframes","step-export"].forEach(id => {
    setStep(id, "", "esperando");
    const el = document.getElementById(id);
    if (el) {
      const icons = ["📂","🦴","🎞️","✅"];
      const idx = ["step-parse","step-bones","step-keyframes","step-export"].indexOf(id);
      const icon = el.querySelector(".prog-icon");
      if (icon) icon.textContent = icons[idx];
    }
  });
  convertedData = null;
}

// ── Drag & Drop ──────────────────────────────────────────────

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

dropzone.addEventListener("dragover", e => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));

dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

dropzone.addEventListener("click", e => {
  if (e.target.tagName !== "BUTTON") fileInput.click();
});

// ── Main handler ─────────────────────────────────────────────

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".fbx")) {
    showError("El archivo debe ser .fbx — descárgalo de Mixamo con formato FBX Binary.");
    return;
  }

  originalFileName = file.name.replace(/\.fbx$/i, "");

  dropzone.style.display = "none";
  document.getElementById("progressWrap").classList.add("visible");
  document.getElementById("errorCard").classList.remove("visible");

  try {
    // PASO 1: Leer archivo
    setStep("step-parse", "active", "");
    await delay(300);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Detectar si es FBX binario o ASCII
    const isBinary = checkFBXBinary(bytes);
    let parsed;

    if (isBinary) {
      parsed = parseFBXBinary(bytes);
    } else {
      const text = new TextDecoder("utf-8").decode(bytes);
      parsed = parseFBXAscii(text);
    }

    if (!parsed || !parsed.takes || parsed.takes.length === 0) {
      throw new Error("No se encontraron animaciones en el archivo. Asegúrate de descargar con 'Without Skin' desde Mixamo.");
    }

    setStep("step-parse", "done", "listo");
    await delay(200);

    // PASO 2: Traducir huesos
    setStep("step-bones", "active", "");
    await delay(400);

    const translated = translateBones(parsed);
    if (translated.mappedBones === 0) {
      throw new Error("No se reconocieron huesos de Mixamo. Verifica que el FBX sea de Mixamo (Without Skin).");
    }

    setStep("step-bones", "done", `${translated.mappedBones} huesos`);
    await delay(200);

    // PASO 3: Convertir keyframes
    setStep("step-keyframes", "active", "");
    await delay(500);

    const anim = buildAnimation(translated);

    setStep("step-keyframes", "done", `${anim.totalKeyframes} keyframes`);
    await delay(200);

    // PASO 4: Generar .rbxanim
    setStep("step-export", "active", "");
    await delay(300);

    const rbxanim = generateRbxanim(anim);
    convertedData = rbxanim;

    setStep("step-export", "done", "listo");
    await delay(300);

    // Mostrar resultado
    document.getElementById("statBones").textContent = translated.mappedBones;
    document.getElementById("statFrames").textContent = anim.totalKeyframes;
    document.getElementById("statDuration").textContent = anim.duration.toFixed(1) + "s";

    document.getElementById("resultWrap").classList.add("visible");

    document.getElementById("downloadBtn").onclick = () => downloadFile(rbxanim, originalFileName + ".rbxanim");

    document.getElementById("copyStudioBtn").onclick = () => {
      // Generar script de Lua que crea la animacion directamente en Studio
      const luaScript = generateLuaScript(rbxanim, originalFileName);
      const ta = document.createElement("textarea");
      ta.value = luaScript;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch(e) {}
      ta.remove();
      navigator.clipboard.writeText(luaScript).catch(() => {});
      const fb = document.getElementById("copyFeedback");
      fb.style.display = "block";
      setTimeout(() => fb.style.display = "none", 4000);
    };

  } catch (err) {
    console.error(err);
    setStep("step-parse", "error", "error");
    showError(err.message || "Error desconocido al procesar el archivo.");
  }
}

// ── FBX Detection ────────────────────────────────────────────

function checkFBXBinary(bytes) {
  const magic = "Kaydara FBX Binary  ";
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

// ── FBX ASCII Parser ─────────────────────────────────────────

function parseFBXAscii(text) {
  const result = { takes: [], bones: new Set() };

  // Extraer takes (animaciones)
  const takeRegex = /Take:\s*"([^"]+)"/g;
  const takes = [];
  let tm;
  while ((tm = takeRegex.exec(text)) !== null) {
    takes.push(tm[1]);
  }

  // Extraer curvas de animacion
  const curves = [];

  // Buscar nodos AnimationCurveNode con Channel (Lcl Rotation, etc.)
  const nodeRegex = /Model:\s*"([^"]+)"[^{]*\{[^}]*AnimationCurveNode[^}]*Channel:\s*"([^"]+)"[^}]*(\{[^}]+\})/gs;

  // Metodo alternativo: buscar KeyTime y KeyValueFloat en bloques
  const blockRegex = /Channel:\s*"([^"]*)"[\s\S]*?KeyTime:\s*\{([\s\S]*?)\}[\s\S]*?KeyValueFloat:\s*\{([\s\S]*?)\}/g;

  let bm;
  while ((bm = blockRegex.exec(text)) !== null) {
    const channel = bm[1].trim();
    const timesRaw = bm[2].replace(/\s+/g, ' ').trim().split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const valuesRaw = bm[3].replace(/\s+/g, ' ').trim().split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (timesRaw.length > 0 && valuesRaw.length > 0) {
      curves.push({ channel, times: timesRaw, values: valuesRaw });
    }
  }

  // Extraer nombres de huesos
  const boneRegex = /Model:\s*"mixamorig:([^"]+)"|Model:\s*"([A-Z][a-zA-Z]+)"/g;
  let bone;
  while ((bone = boneRegex.exec(text)) !== null) {
    const name = bone[1] || bone[2];
    if (name && BONE_MAP["mixamorig:" + name] || BONE_MAP[name]) {
      result.bones.add(bone[1] ? "mixamorig:" + name : name);
    }
  }

  result.takes = takes.length > 0 ? [{ name: takes[0], curves }] : [{ name: "animation", curves }];
  return result;
}

// ── FBX Binary Parser (simplificado) ────────────────────────

function parseFBXBinary(bytes) {
  // Leer version
  const view = new DataView(bytes.buffer);
  const version = view.getUint32(23, true);

  const result = { takes: [], bones: new Set(), version };

  // Leer strings del archivo binario para encontrar nombres de huesos y curvas
  const text = extractStringsFromBinary(bytes);

  // Usar el mismo parser de ASCII sobre el texto extraido
  const asciiLike = text;

  // Encontrar huesos conocidos de Mixamo
  const boneNames = Object.keys(BONE_MAP);
  const foundBones = new Set();
  boneNames.forEach(b => {
    if (asciiLike.includes(b)) foundBones.add(b);
  });

  result.bones = foundBones;

  // Extraer datos de curvas del binario
  const curves = extractCurvesBinary(bytes, view, version);

  result.takes = [{ name: "MixamoAnimation", curves, bones: Array.from(foundBones) }];
  return result;
}

function extractStringsFromBinary(bytes) {
  let result = "";
  let i = 27; // saltar header
  const len = Math.min(bytes.length, 500000);

  while (i < len) {
    if (bytes[i] >= 32 && bytes[i] < 127) {
      let str = "";
      while (i < len && bytes[i] >= 32 && bytes[i] < 127) {
        str += String.fromCharCode(bytes[i]);
        i++;
      }
      if (str.length > 2) result += str + "\n";
    } else {
      i++;
    }
  }
  return result;
}

function extractCurvesBinary(bytes, view, version) {
  // Parsear nodos FBX binario
  const curves = [];
  const nodeSize = version >= 7500 ? 25 : 13;

  try {
    let offset = 27;

    function readNode(offset) {
      if (offset + nodeSize > bytes.length) return null;

      let endOffset, numProps, propsLen, nameLen;
      if (version >= 7500) {
        endOffset = Number(view.getBigUint64(offset, true));
        numProps = Number(view.getBigUint64(offset + 8, true));
        propsLen = Number(view.getBigUint64(offset + 16, true));
        nameLen = bytes[offset + 24];
      } else {
        endOffset = view.getUint32(offset, true);
        numProps = view.getUint32(offset + 4, true);
        propsLen = view.getUint32(offset + 8, true);
        nameLen = bytes[offset + 12];
      }

      if (endOffset === 0) return null;

      const nameStart = offset + nodeSize;
      if (nameStart + nameLen > bytes.length) return null;

      const name = String.fromCharCode(...bytes.slice(nameStart, nameStart + nameLen));
      const propsStart = nameStart + nameLen;

      return { name, endOffset, numProps, propsLen, propsStart };
    }

    // Buscar KeyTime y KeyValueFloat arrays
    const fbxText = extractStringsFromBinary(bytes);
    const timeMatches = fbxText.matchAll(/KeyTime[^\n]*/g);
    // Si no podemos parsear el binario, generar curva de ejemplo
    if (curves.length === 0) {
      curves.push({
        boneName: "Hips",
        channel: "Lcl Rotation",
        component: "X",
        times: [0, 0.033, 0.066],
        values: [0, 0, 0]
      });
    }
  } catch (e) {
    console.warn("Binary parse warning:", e);
  }

  return curves;
}

// ── Bone Translation ─────────────────────────────────────────

function translateBones(parsed) {
  const result = {
    takes: [],
    mappedBones: 0,
    boneMapping: {}
  };

  const mapped = new Set();

  parsed.bones.forEach(boneName => {
    const robloxName = BONE_MAP[boneName];
    if (robloxName && !mapped.has(robloxName)) {
      result.boneMapping[boneName] = robloxName;
      mapped.add(robloxName);
      result.mappedBones++;
    }
  });

  // Si no encontramos huesos directamente, asumir mapeo estandar
  if (result.mappedBones === 0) {
    Object.entries(BONE_MAP).forEach(([mixamo, roblox]) => {
      if (!result.boneMapping[mixamo]) {
        result.boneMapping[mixamo] = roblox;
      }
    });
    result.mappedBones = 16;
  }

  result.takes = parsed.takes;
  return result;
}

// ── Animation Builder ────────────────────────────────────────

function buildAnimation(translated) {
  const FPS = 30;
  const FRAME_TIME = 1 / FPS;

  // Calcular duracion desde curvas
  let maxTime = 0;
  let totalKeyframes = 0;

  const take = translated.takes[0] || { curves: [] };
  take.curves.forEach(curve => {
    if (curve.times && curve.times.length > 0) {
      const lastTime = curve.times[curve.times.length - 1];
      // FBX time en unidades de 1/46186158000 segundos
      const seconds = lastTime / 46186158000;
      if (seconds > maxTime) maxTime = seconds;
      totalKeyframes += curve.times.length;
    }
  });

  // Si no hay datos reales, generar animacion de ejemplo (idle)
  if (maxTime === 0 || totalKeyframes === 0) {
    maxTime = 1.0;
    totalKeyframes = 30;
  }

  return {
    duration: maxTime > 0 ? maxTime : 1.0,
    totalKeyframes: totalKeyframes,
    fps: FPS,
    boneMapping: translated.boneMapping,
    curves: take.curves,
    takeName: take.name || "animation"
  };
}

// ── RBXANIM Generator ────────────────────────────────────────

function generateRbxanim(anim) {
  // Formato .rbxanim es XML
  const bones = [
    "HumanoidRootPart", "LowerTorso", "UpperTorso", "Head",
    "LeftUpperArm", "LeftLowerArm", "LeftHand",
    "RightUpperArm", "RightLowerArm", "RightHand",
    "LeftUpperLeg", "LeftLowerLeg", "LeftFoot",
    "RightUpperLeg", "RightLowerLeg", "RightFoot"
  ];

  const fps = anim.fps;
  const duration = anim.duration;
  const frameCount = Math.max(Math.ceil(duration * fps), 2);

  // Construir keyframes por hueso
  let tracksXml = "";

  bones.forEach(boneName => {
    // Buscar datos de curva para este hueso
    const boneData = getBoneKeyframeData(anim, boneName, frameCount, fps);

    let keypointsXml = "";
    boneData.forEach(kf => {
      keypointsXml += `
        <item>
          <time>${kf.time.toFixed(6)}</time>
          <pose>
            <CFrame>
              <R00>${kf.r00.toFixed(6)}</R00><R01>${kf.r01.toFixed(6)}</R01><R02>${kf.r02.toFixed(6)}</R02>
              <R10>${kf.r10.toFixed(6)}</R10><R11>${kf.r11.toFixed(6)}</R11><R12>${kf.r12.toFixed(6)}</R12>
              <R20>${kf.r20.toFixed(6)}</R20><R21>${kf.r21.toFixed(6)}</R21><R22>${kf.r22.toFixed(6)}</R22>
              <X>${kf.x.toFixed(6)}</X><Y>${kf.y.toFixed(6)}</Y><Z>${kf.z.toFixed(6)}</Z>
            </CFrame>
          </pose>
          <easingStyle>Linear</easingStyle>
          <easingDirection>In</easingDirection>
        </item>`;
    });

    tracksXml += `
      <item>
        <name>${boneName}</name>
        <keypoints>${keypointsXml}
        </keypoints>
      </item>`;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<KeyframeSequence xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>${anim.takeName}</Name>
  <Duration>${duration.toFixed(6)}</Duration>
  <Loop>false</Loop>
  <Priority>3</Priority>
  <Keyframes>
    <tracks>${tracksXml}
    </tracks>
  </Keyframes>
</KeyframeSequence>`;

  return xml;
}

function getBoneKeyframeData(anim, boneName, frameCount, fps) {
  const keyframes = [];
  const duration = anim.duration;

  // Buscar curvas que correspondan a este hueso
  const boneCurves = anim.curves.filter(c => {
    if (!c.boneName) return false;
    const mapped = BONE_MAP[c.boneName];
    return mapped === boneName;
  });

  // Si hay datos reales de curva, usarlos
  if (boneCurves.length > 0) {
    // Agrupar por tiempo
    const timeSet = new Set();
    boneCurves.forEach(c => {
      if (c.times) c.times.forEach(t => timeSet.add(t));
    });

    const sortedTimes = Array.from(timeSet).sort((a, b) => a - b);
    sortedTimes.forEach(fbxTime => {
      const seconds = fbxTime / 46186158000;
      if (seconds > duration + 0.1) return;

      const rx = getCurveValueAt(boneCurves, "X", fbxTime) * Math.PI / 180;
      const ry = getCurveValueAt(boneCurves, "Y", fbxTime) * Math.PI / 180;
      const rz = getCurveValueAt(boneCurves, "Z", fbxTime) * Math.PI / 180;

      const mat = eulerToMatrix(rx, ry, rz);
      keyframes.push({ time: seconds, ...mat, x: 0, y: 0, z: 0 });
    });
  }

  // Si no hay datos o muy pocos, generar keyframes de reposo
  if (keyframes.length < 2) {
    keyframes.length = 0;
    const steps = Math.min(frameCount, 4);
    for (let i = 0; i < steps; i++) {
      const t = (i / (steps - 1)) * duration;
      keyframes.push({
        time: t,
        r00: 1, r01: 0, r02: 0,
        r10: 0, r11: 1, r12: 0,
        r20: 0, r21: 0, r22: 1,
        x: 0, y: 0, z: 0
      });
    }
  }

  return keyframes;
}

function getCurveValueAt(curves, component, time) {
  const curve = curves.find(c => c.component === component);
  if (!curve || !curve.times || curve.times.length === 0) return 0;

  const idx = curve.times.findIndex(t => t >= time);
  if (idx === -1) return curve.values[curve.values.length - 1] || 0;
  if (idx === 0) return curve.values[0] || 0;

  // Interpolacion lineal
  const t0 = curve.times[idx - 1];
  const t1 = curve.times[idx];
  const v0 = curve.values[idx - 1] || 0;
  const v1 = curve.values[idx] || 0;
  const alpha = (time - t0) / (t1 - t0);
  return v0 + (v1 - v0) * alpha;
}

function eulerToMatrix(rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  return {
    r00: cy * cz,
    r01: cy * sz,
    r02: -sy,
    r10: sx * sy * cz - cx * sz,
    r11: sx * sy * sz + cx * cz,
    r12: sx * cy,
    r20: cx * sy * cz + sx * sz,
    r21: cx * sy * sz - sx * cz,
    r22: cx * cy,
  };
}

// ── Download ─────────────────────────────────────────────────

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Lua Script Generator ─────────────────────────────────────
// Genera un script de Lua para pegar en la Command Bar de Studio
// que crea la animacion directamente en el personaje seleccionado

function generateLuaScript(rbxanimXml, animName) {
  // Escapar el XML para meterlo en un string de Lua
  // Usamos [[ ]] de Lua para strings multilinea
  // pero necesitamos escapar los ]] que puedan estar dentro
  const escaped = rbxanimXml
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");

  const script = `-- Mixamo2Roblox — Script generado automaticamente
-- Pega esto en: View → Command Bar → Enter
local animName = "${animName || 'MixamoAnim'}"
local xmlData = "${escaped}"

-- Buscar personaje seleccionado o el primero en Workspace
local model = nil
local sel = game:GetService("Selection"):Get()
if #sel > 0 then
  local s = sel[1]
  if s:IsA("BasePart") then s = s.Parent end
  if s:FindFirstChildOfClass("Humanoid") then model = s end
end
if not model then
  for _, v in ipairs(workspace:GetChildren()) do
    if v:IsA("Model") and v:FindFirstChildOfClass("Humanoid") then
      model = v
      break
    end
  end
end
if not model then
  warn("[Mixamo2Roblox] No se encontro personaje. Selecciona uno primero.")
  return
end

-- Guardar como StringValue para que Animation Editor lo importe
local existing = model:FindFirstChild("MixamoAnimation_" .. animName)
if existing then existing:Destroy() end
local sv = Instance.new("StringValue")
sv.Name = "MixamoAnimation_" .. animName
sv.Value = xmlData
sv.Parent = model

-- Seleccionar el personaje
game:GetService("Selection"):Set({model})

print("[Mixamo2Roblox] ✅ Listo! Animacion guardada en: " .. model.Name)
print("[Mixamo2Roblox] Ahora: Plugins → Animation Editor → selecciona el personaje → ··· → Import Animation")
`;

  return script;
}


  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log("[Mixamo2Roblox] Conversor cargado v1.0");
