/**
 * Generate high-quality HD pixel art sprites for all 12 keepBoard themes.
 * Each sprite is defined at 32x32 and rendered to 128x128 PNG.
 * Outputs to src/assets/pets/hd/
 *
 * Run: node scripts/generate-sprites.mjs
 */
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'pets', 'hd')
fs.mkdirSync(OUT_DIR, { recursive: true })

const GRID = 32
const SCALE = 4
const OUTPUT = GRID * SCALE

function rgba(r, g, b, a = 255) { return [r, g, b, a] }

function renderSprite(template, palette) {
  const png = new PNG({ width: OUTPUT, height: OUTPUT })
  for (let y = 0; y < OUTPUT; y++) {
    const gy = Math.floor(y / SCALE)
    for (let x = 0; x < OUTPUT; x++) {
      const gx = Math.floor(x / SCALE)
      const ch = template[gy]?.[gx] ?? '.'
      const c = palette[ch] ?? rgba(0, 0, 0, 0)
      const idx = (y * OUTPUT + x) << 2
      png.data[idx]     = c[0]
      png.data[idx + 1] = c[1]
      png.data[idx + 2] = c[2]
      png.data[idx + 3] = c[3]
    }
  }
  return PNG.sync.write(png)
}

function makeBlink(openTemplate, eyeL, eyeR, bgChar = 'm') {
  const blink = openTemplate.map(row => row.split(''))
  if (eyeL) {
    for (let dy = 0; dy < eyeL[3]; dy++) {
      for (let dx = 0; dx < eyeL[2]; dx++) {
        const y = eyeL[1] + dy
        const x = eyeL[0] + dx
        if (blink[y]) blink[y][x] = bgChar
      }
    }
    const ey = eyeL[1] + Math.floor(eyeL[3] / 2)
    const ex1 = eyeL[0]
    const ex2 = eyeL[0] + eyeL[2] - 1
    if (blink[ey]) {
      blink[ey][ex1] = 'b'
      blink[ey][ex2] = 'b'
    }
  }
  if (eyeR) {
    for (let dy = 0; dy < eyeR[3]; dy++) {
      for (let dx = 0; dx < eyeR[2]; dx++) {
        const y = eyeR[1] + dy
        const x = eyeR[0] + dx
        if (blink[y]) blink[y][x] = bgChar
      }
    }
    const ey = eyeR[1] + Math.floor(eyeR[3] / 2)
    const ex1 = eyeR[0]
    const ex2 = eyeR[0] + eyeR[2] - 1
    if (blink[ey]) {
      blink[ey][ex1] = 'b'
      blink[ey][ex2] = 'b'
    }
  }
  return blink.map(row => row.join(''))
}

function writeFrame(name, template, palette) {
  const buf = renderSprite(template, palette)
  const out = path.join(OUT_DIR, name)
  fs.writeFileSync(out, buf)
  console.log(`  wrote ${name}`)
}

function writeSprite(theme, template, palette, eyeL, eyeR) {
  writeFrame(`${theme}_idle_open.png`, template, palette)
  const blink = makeBlink(template, eyeL, eyeR)
  writeFrame(`${theme}_idle_blink.png`, blink, palette)
}

// ========== SPRITE DEFINITIONS ==========

// ---- PIRANHA (食人花) ----
const piranhaPal = {
  o: rgba(110, 27, 16),
  d: rgba(194, 59, 34),
  m: rgba(232, 93, 58),
  l: rgba(255, 140, 66),
  s: rgba(255, 194, 77),
  w: rgba(255, 255, 255),
  b: rgba(24, 24, 40),
  t: rgba(255, 246, 216),
  k: rgba(240, 138, 138),
  g: rgba(45, 90, 39),
  G: rgba(74, 143, 60),
  L: rgba(168, 224, 99),
  n: rgba(92, 58, 26),
  N: rgba(139, 90, 43),
  B: rgba(176, 120, 66),
  P: rgba(140, 60, 30),
}
const piranhaOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '..........oooooooooo............',
  '........ooddddddddoo...........',
  '.......odmmllllllmdo...........',
  '......odmllwsswwllmdo..........',
  '.....odmlwwswwswwlmdo.........',
  '.....odmlbbwlbwwbbmlmo........',
  '.odmlwwblwwlwwlwwblmdo........',
  '.odmlllllllllllllllmdo........',
  '.odmttttttttttttttmdo.........',
  '.odtbbbbbbbbbbbbbbtdo.........',
  '.odbtbtbbbbbbbtbtbmdo.........',
  '.odtbbbbbbbbbbbbbbmdo.........',
  '..odttbbbbbbbbbbttddo.........',
  '..oddmmtttttttmdddo...........',
  '...oddmddddddmddo.............',
  '....oggggggggggo..............',
  '..gL.oGGggggGGo.lg............',
  '.gLggoGGnGGnGGogLgg...........',
  '..ggo.oGnnnnnGo.ogg...........',
  '.gg....onnnno....gg...........',
  '.g......oooooo.....g..........',
  '......oBBBBBBo...............',
  '.....oBBBBBBBBo..............',
  '....oBBnnnnnnBBo.............',
  '....oBnnNNNNnnBo.............',
  '...oBnnnNNNnnnnBo............',
  '...obnnnnnnnnnnbo............',
  '....oooooooooooo.............',
]
writeSprite('piranha', piranhaOpen, piranhaPal,
  null, null)

// ---- CACTUS (仙人掌) ----
const cactusPal = {
  o: rgba(23, 58, 23),
  d: rgba(45, 122, 45),
  m: rgba(63, 163, 63),
  l: rgba(102, 204, 85),
  s: rgba(155, 232, 122),
  y: rgba(255, 217, 61),
  r: rgba(232, 93, 58),
  R: rgba(255, 140, 66),
  w: rgba(255, 255, 255),
  b: rgba(24, 24, 40),
  n: rgba(92, 58, 26),
  N: rgba(139, 90, 43),
  B: rgba(176, 120, 66),
  G: rgba(80, 180, 70),
}
const cactusOpen = [
  '................................',
  '................................',
  '................................',
  '...........oyyo................',
  '..........orRRro...............',
  '...........oyyo................',
  '.........oommmmoo..............',
  '........omllllllmm.............',
  '.......omlkmmmmklmmo...........',
  '......odmmmmmmmmmmmdo..........',
  '......odmdmmdmmdmmdo..........',
  '.oo..odmdmmdmmdmmdo....oo.....',
  'omo.odmdmmdmmdmmdo....omo.....',
  'ommo.odmdmmdmmdmmdo..ommo.....',
  '.ommoodmmmmmmmmmmoommo........',
  '..ommmmmmmmmmmmmmmmmo.........',
  '...ommmmmmmmmmmmmmmo..........',
  '....odddddddddddddd...........',
  '.....ooooooooooooooo...........',
  '......oBBBBBBBBBo.............',
  '.....oBBBnnnnnBBBo............',
  '.....oBnnnNNNnnnBo............',
  '....oBnnnnNNNnnnnBo...........',
  '....obnnnnnnnnnnnbo...........',
  '.....ooooooooooooo............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('cactus', cactusOpen, cactusPal,
  [7, 5, 3, 3], [13, 5, 3, 3])

// ---- SLIME (史莱姆) ----
const slimePal = {
  o: rgba(31, 95, 139),
  d: rgba(46, 134, 171),
  m: rgba(84, 185, 223),
  l: rgba(138, 216, 239),
  s: rgba(234, 251, 255),
  b: rgba(24, 24, 40),
  k: rgba(240, 138, 138),
  t: rgba(255, 246, 216),
  G: rgba(180, 240, 255),
}
const slimeOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '........oooooo................',
  '......oomlllmmoo..............',
  '.....omlssssllmmo.............',
  '....omlslllllllmmo............',
  '...ommsllmmmmmmmmo............',
  '..ommmmmmmmmmmmmmmo...........',
  '..ommmmmmmmmmmmmmmo...........',
  '.ommmmmmmmmmmmmmmmmo..........',
  '.ommmmmmmmmmmmmmmmmo..........',
  '.ommmbbbmmmmmbbbmmmo..........',
  'ommmbbsbmmmmmbbsbmmmo.........',
  'ommmbbbbmmkmmmbbbbmmo.........',
  'ommmmmmmmkkmkmmmmmmmmo........',
  'ommmmmmmkkkkmmmmmmmmmo........',
  'ommmmmmmmmmmmmmmmmmmmmdo......',
  'ommmmmmmmmmmmmmmmmmmmddo......',
  'odmmmmmmmmmmmmmmmmmmdddo......',
  'oddddddddddddddddddddddo.....',
  '.oooooooooooooooooooooooo.....',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('slime', slimeOpen, slimePal,
  [6, 9, 3, 3], [13, 9, 3, 3])

// ---- CAT (像素猫) ----
const catPal = {
  o: rgba(51, 48, 74),
  d: rgba(85, 79, 112),
  m: rgba(133, 125, 166),
  l: rgba(167, 159, 196),
  s: rgba(220, 214, 240),
  w: rgba(255, 255, 255),
  b: rgba(24, 24, 40),
  k: rgba(240, 138, 138),
  n: rgba(232, 155, 176),
  N: rgba(200, 120, 150),
}
const catOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  'oo......................oo.....',
  'oddo....................oddo...',
  'odndo..................ondno...',
  'odkdo....oommoo......odkdo....',
  '..oddommmmmmmmmmmmmoddo.......',
  '..odmllmmmmmmmmmllmmmdo.......',
  '.odmllmmmmmmmmmmmllmmmdo......',
  '.odmmmmmmmmmmmmmmmmmmmdo......',
  'odmmmbbwmmmmmmmwwbmmmmmo......',
  'odmmmbwkbmmmmmmkwkbmmmmo......',
  'odmmmbbbmmmmmmmbbbmmmmmo......',
  'odmmmmmmmmknkmmmmmmmmmmo......',
  'odmmmmmmmmwwwmmmmmmmmmmo......',
  '.odmmmmmmmwwmmmmmmmmmdo.......',
  '.odmmwwmmmmwwmmmwwmmmdo.......',
  '.odmwwwwwwwwwwwwwwwmmdo.......',
  '.odmwwwwwwwwwwwwwwwmmdo.......',
  '..odmwwwwwwwwwwwwwwmmdo.......',
  '..odmmmwwwwwwwwwmmmmdo........',
  '...odmmmmmmmmmmmmmmmdo........',
  '...odmmmmmmmmmmmmmmmdo........',
  '....oddddddddddddddddo........',
  '.....oooooooooooooooo..........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('cat', catOpen, catPal,
  [6, 9, 4, 3], [14, 9, 4, 3])

// ---- MUSHROOM (马里奥蘑菇) ----
const mushPal = {
  o: rgba(122, 21, 21),
  d: rgba(194, 59, 34),
  m: rgba(232, 93, 58),
  l: rgba(255, 140, 66),
  s: rgba(255, 194, 77),
  w: rgba(255, 246, 224),
  W: rgba(255, 255, 255),
  b: rgba(24, 24, 40),
  k: rgba(240, 138, 138),
  n: rgba(201, 174, 114),
  N: rgba(242, 223, 182),
  L: rgba(123, 201, 90),
  g: rgba(45, 90, 39),
  P: rgba(180, 50, 50),
}
const mushOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '.......ooooooooooo.............',
  '.....ooolldddddloo.............',
  '...oolmmmddddddmmloo...........',
  '..olmmmdddddddddmmlo..........',
  '.olmmWWdddddsdddWWmlo.........',
  '.olmWWWdddddsssssddWmlo.......',
  'olmmWWdddddddssssddmlo........',
  'olmmddddddsdddddddmmlo........',
  'olmmddddddddsddddssmlo........',
  '.ollllllllllllllllllo..........',
  '..onNNNNNNNNNNNNNNNno..........',
  '..onNNNNNNNNNNNNNNNno..........',
  '..onNbwbNNNNNNNbwbNno..........',
  '..onNbbNNNNNNNbbNNNno..........',
  '..onnNNNkkkNNNNNNnno..........',
  '..onNNNNNbbNNNNNNNno..........',
  '...onNNNNNNNNNNNNNno..........',
  '....onnnnnnnnnnnnno...........',
  '.....oLLoo..ooLLo.............',
  '....ogLo......oLgo............',
  '.....oo........oo.............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('mushroom', mushOpen, mushPal,
  [7, 17, 3, 3], [14, 17, 3, 3])

// ---- GHOST (幽灵) ----
const ghostPal = {
  o: rgba(73, 83, 122),
  d: rgba(136, 145, 176),
  m: rgba(198, 204, 228),
  l: rgba(234, 238, 250),
  s: rgba(255, 255, 255),
  b: rgba(35, 39, 67),
  k: rgba(240, 138, 138),
  G: rgba(200, 220, 255),
}
const ghostOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '.......ooooooooo...............',
  '.....oommmmmmmmoo..............',
  '....omllllllllllmo.............',
  '...omllllllllllllmo............',
  '..omllmmllllllmllmmo..........',
  '..omllmmllllllllmllmo..........',
  '.omllmmllllllllllllmo..........',
  '.omllbbbbbmmmlbbbbbmo..........',
  '.omlmbwsbbmmlmbwsbbmo..........',
  '.omlmbbbbmmlmbbbbmlo..........',
  '.omllmmmmmmmmmmmmlo...........',
  '.omlkmmmmmbbmmmmmmo...........',
  '.ommmmmmmmbbbmmmmmo...........',
  '.ommmmmmmmbbmmmmmmmo..........',
  '.ommmmmmmmmmmmmmmmmdo.........',
  '.ommmmmmmmmmmmmmmmddo.........',
  '..ommmmmmmmmmmmmddo...........',
  '...omlommmmmmmomlo............',
  '....o..oooooo..o..............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('ghost', ghostOpen, ghostPal,
  [5, 8, 4, 3], [13, 8, 4, 3])

// ---- DINO (小恐龙) ----
const dinoPal = {
  o: rgba(30, 77, 30),
  d: rgba(63, 137, 41),
  m: rgba(106, 190, 48),
  l: rgba(143, 217, 76),
  s: rgba(198, 242, 115),
  w: rgba(255, 255, 255),
  b: rgba(24, 24, 40),
  t: rgba(255, 246, 216),
  k: rgba(200, 60, 60),
  S: rgba(80, 160, 50),
}
const dinoOpen = [
  '................................',
  '................................',
  '................................',
  '......ooooooooo................',
  '.....oddddddmo................',
  '....odmwslmmmo...............',
  '....ombbwslmmo...............',
  '....ombbwslmmmo..............',
  '....odmmllmmmmoddmmo..........',
  '.....odmmmmmmmddddo...........',
  '..oo.odmttmmmmmmmo...........',
  '.oddo.dmmmmmmmmmo............',
  '.odmoommmmmmmmmo.............',
  '..odmmmmmmmmmmmmo............',
  '..odmmmmmmdmmmmmo............',
  '...odmmmddddmmmmo............',
  '...odmmmddddmmmmo............',
  '....odmmmddmmmmdo............',
  '....odmmmmmmmmdmo............',
  '.....odmmmmmmmmdo............',
  '.....odmmmmmmmmdo............',
  '......odmmmmmmmdo............',
  '......odmmmdmmdo.............',
  '.....odmmdodmmmdo............',
  '....odmdo.odmdodo............',
  '....oddo...oddo.o............',
  '.....oo.....oo...............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('dino', dinoOpen, dinoPal,
  null, [7, 3, 3, 3])

// ---- ROBOT (机器人) ----
const robotPal = {
  o: rgba(34, 42, 56),
  d: rgba(74, 85, 104),
  m: rgba(138, 151, 173),
  l: rgba(195, 206, 223),
  s: rgba(239, 244, 251),
  G: rgba(123, 247, 123),
  R: rgba(255, 78, 80),
  y: rgba(255, 217, 61),
  b: rgba(14, 17, 24),
  Y: rgba(255, 220, 100),
  n: rgba(100, 120, 140),
}
const robotOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '............yy.................',
  '............yy.................',
  '...........oddo................',
  '........ooomddmooo.............',
  '.....oommmmmmmmmmmmo..........',
  '....omllmmmmmmmmmlmo..........',
  '...omlldbbbbbbbbdllmo.........',
  '..omlldbddddddddbdllmo........',
  '..omldbdbbbbbbbdbdblmo........',
  '..omldbdbGGdbGGdbdblmo........',
  '..omldbdbbbbbbbdbdblmo........',
  '..ommldbdddddddddblmmo........',
  '..ommmlbdbbdbbdbblmmo.........',
  '...ommmlbbbbbbbbblmmo.........',
  '....oommmmllllmmmmoo..........',
  '.....odmmmmmmmmmmmdo..........',
  '....odmddddddddmmmmdo.........',
  '....odmdddddmmmdddmddo........',
  '....odmmdddddmmmmmmdo.........',
  '....odmmmmmmmmmmmmmdo.........',
  '.....odddddddddddddo..........',
  '....oddooodddooodddo..........',
  '....oddo..oddo..oddo..........',
  '.....oo....oo....oo...........',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('robot', robotOpen, robotPal,
  [9, 10, 3, 2], [15, 10, 3, 2])

// ---- PUMPKIN (南瓜灯) ----
const pumpPal = {
  o: rgba(122, 58, 16),
  d: rgba(192, 90, 29),
  m: rgba(242, 132, 37),
  l: rgba(255, 166, 77),
  s: rgba(255, 208, 138),
  b: rgba(20, 20, 32),
  G: rgba(255, 224, 138),
  g: rgba(45, 90, 39),
  L: rgba(123, 201, 90),
  n: rgba(74, 143, 60),
  y: rgba(255, 240, 150),
}
const pumpkinOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '............ogo................',
  '...........ognno...............',
  '...........ognno...............',
  '........oooonnnooo.............',
  '.....oommmmmmmmmmmmo..........',
  '...ommmmmmllmmmmmmmmmo........',
  '..ommmmllllmmmmmmmmmmmo.......',
  '..ommllmmmmmmmddmmmmmmdo......',
  '.ommllmmmmmmmmmddmmmmmmdo.....',
  '.ommmmmGGGmmmdddmmmGGGmmo.....',
  'ommmmmGGGGGmmmddmmGGGGGmmo....',
  'ommmmmmGGGmmmmmmmmmmmmmmmo....',
  'ommmmmmmmmmmmmmmmmmmmmmmmo....',
  'ommmmmbbbmmmmmmmmmbbbmmmmo....',
  'ommmmmbsbbmmmmmmmbsbbmmmo.....',
  'ommmmmmmmmmmmmmmmmmmmmmmdo....',
  'ommmmmbbbbbbbbbbbbbbbmmmdo....',
  'ommmmbGbGbGbGbGbGbGbmmmddo...',
  'ommmmmbbbbbbbbbbbbbbmmmddo....',
  '.ommmmmmmmmmmmmmmmmmmmddo.....',
  '..ommmmmmmmmmmmmmmmmmmddo.....',
  '...ommmmmmmmmmmmmmmmmddo......',
  '....odddddddddddddddddddo.....',
  '.....oooooooooooooooooo........',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('pumpkin', pumpkinOpen, pumpPal,
  [8, 13, 3, 3], [17, 13, 3, 3])

// ---- PENGUIN (企鹅) ----
const pengPal = {
  o: rgba(16, 20, 28),
  d: rgba(32, 40, 58),
  m: rgba(57, 68, 92),
  l: rgba(255, 255, 255),
  s: rgba(244, 247, 255),
  y: rgba(255, 179, 71),
  Y: rgba(232, 145, 45),
  b: rgba(20, 20, 32),
  k: rgba(240, 138, 138),
  w: rgba(240, 245, 255),
  W: rgba(255, 255, 255),
}
const penguinOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '.......ooooooooo...............',
  '.....oommmmmmmmoo..............',
  '....ommmmmmmmmmmo.............',
  '...ommmmmmmmmmmmo.............',
  '..ommlilllllllllmmo...........',
  '..ommlilllllllllmmo...........',
  '.ommlillbblllbblllmo..........',
  '.ommlilsbbllsbblllmo..........',
  '.ommlilllyyilllllmmo..........',
  '.ommlilllyyilllllmmo..........',
  '.omlkllllllllllllkmo..........',
  '.ommlilllllllllllmmo..........',
  'odmmillllllllllmmdo...........',
  'odmmillllllllllmmdo...........',
  'odmillllllllllllmdo...........',
  'odmmillllllllllmmo............',
  '.odmillllllllllmmdo...........',
  '.odmmillllllllmmmo............',
  '..odmmillllllmmddo............',
  '...odmmmmmmmdddo..............',
  '....odddddddddo...............',
  '.....oYYo...oYYo..............',
  '....oYYYo....oYYYo............',
  '.....ooo......ooo.............',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('penguin', penguinOpen, pengPal,
  [6, 7, 3, 3], [13, 7, 3, 3])

// ---- ALIEN (外星人) ----
const alienPal = {
  o: rgba(18, 59, 18),
  d: rgba(46, 125, 50),
  m: rgba(87, 200, 77),
  l: rgba(143, 224, 138),
  s: rgba(200, 255, 196),
  b: rgba(24, 24, 40),
  w: rgba(255, 255, 255),
  r: rgba(255, 78, 80),
  G: rgba(120, 255, 120),
  Y: rgba(255, 255, 100),
}
const alienOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..or.................ro........',
  '...or...............ro.........',
  '...odo.............odo........',
  '....odo...........odo.........',
  '.....odoooooooodo.............',
  '....odmllllllmmo.............',
  '...odmllllllllmmo.............',
  '..odmllllllllllmmo............',
  '.odmllbbbbbbbbblmmo...........',
  '.odmlbbbbbbbbbbbmmo...........',
  'odmlbbwwbbbbbbwwbbmmo.........',
  'odmlbbwsbbbbbbswbbmmo.........',
  'odmmbbbbbbbbbbbbbbmmo.........',
  'odmmmmbbbbbbbbbmmmmo..........',
  'odmmmmbbwwwwwbbmmmmo..........',
  '.odmmmmbbbbbbbmmmmmo..........',
  '.odmmmmmmmmmmmmmmmo...........',
  '..odmmmmmmmmmmmmmo............',
  '...oddo.oddo.odo..............',
  '....odo..odo..odo.............',
  '.....oo...oo...oo.............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
]
writeSprite('alien', alienOpen, alienPal,
  [9, 11, 3, 2], [16, 11, 3, 2])

// ---- FOX (狐狸) ----
const foxPal = {
  o: rgba(92, 42, 13),
  d: rgba(184, 92, 30),
  m: rgba(232, 130, 58),
  l: rgba(255, 168, 92),
  s: rgba(255, 220, 168),
  w: rgba(255, 255, 255),
  b: rgba(24, 24, 40),
  k: rgba(240, 138, 138),
  t: rgba(255, 246, 216),
  n: rgba(200, 100, 50),
}
const foxOpen = [
  '................................',
  '................................',
  '................................',
  '................................',
  'oo......................oo.....',
  'oddo....................oddo...',
  'odkdo..................odkdo...',
  'odkdo....oommoo.......odkdo...',
  '..oddommmmmmmmmmmmoddo........',
  '..odmmllmmmmmmmmllmmmdo.......',
  '.odmmllmmmmmmmmmmllmmmo.......',
  '.odmmmmmmmmmmmmmmmmmmo........',
  'odmmmbbmmmmmmmmmbbmmo.........',
  'odmmbwsbmmmmmmmbwsbmmo........',
  'odmmmbbbmmmmmmmmbbbmmo........',
  'odmmmmmmmmmwwmmmmmmmo.........',
  'odmmmmmmmwwwuwmmmmmo..........',
  '.odmmmmmwwbbwwmmmmmo..........',
  '.odmmmmmwwbbwwmmmmmmdo........',
  '.odmmmmwwwwwwwmmmmmmdo........',
  '..odmmmwwwwwwwmmmmmmdo........',
  '...odmmwwwwwwmmmmmmddo........',
  '...odmmmmmmmmmmmmmddo.........',
  '...odmmmwwwwwmmmmmmdo.........',
  '....odmmmmmmmmmmmmddo.........',
  '....odmmmmmmmmmmmmmdo.........',
  '.....odmmmmmmmmmmmmdo.........',
  '.....odmmdoodmmmdmddo.........',
  '....odmdo..odmdodddo..........',
  '....oddo...oddo.ooo...........',
  '.....oo.....oo................',
  '................................',
]
writeSprite('fox', foxOpen, foxPal,
  [6, 9, 4, 3], [16, 9, 4, 3])

console.log('\nAll 12 HD sprites generated successfully!')
console.log(`Output directory: ${OUT_DIR}`)
