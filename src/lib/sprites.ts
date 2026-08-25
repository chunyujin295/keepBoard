import { PIXEL } from './piranha'

/**
 * Hand-authored pixel-art sprites (one char = one pixel).
 * Shared shading language across every pet:
 *   o = outline   d = dark shade   m = mid/main   l = light   s = specular
 *   w = white     b = black        k = cheek      y = yellow  t = teeth
 *   r = red accent G = glow/green-light
 * Theme palettes translate these semantic chars into real colors, keeping the
 * shading consistent (outline everywhere, light from top-right).
 */

export interface SpriteMeta {
  /** eye rects [x, y, w, h]; either side may be null (profile faces) */
  eyeL: [number, number, number, number] | null
  eyeR: [number, number, number, number] | null
  /** surrounding colour used to erase the eyes while blinking */
  eyeBg: string
  /** mouth rect [x, y, w] — height grows downward while biting */
  mouth?: [number, number, number]
}

export interface Sprite {
  rows: string[]
  pal: Record<string, string>
  meta: SpriteMeta
  /** cached placement: centred horizontally, feet on the ground line */
  place?: { gx: number; gy: number; w: number; h: number }
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  gx: number,
  gy: number,
  alpha = 1
) {
  const prev = ctx.globalAlpha
  if (alpha !== 1) ctx.globalAlpha = alpha
  for (let y = 0; y < s.rows.length; y++) {
    const row = s.rows[y]
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.') continue
      const c = s.pal[ch]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect((gx + x) * PIXEL, (gy + y) * PIXEL, PIXEL, PIXEL)
    }
  }
  ctx.globalAlpha = prev
}

/** centre sprite horizontally, feet on ground line */
export function place(s: Sprite, groundGridY = 58): { gx: number; gy: number; w: number; h: number } {
  if (!s.place) {
    const w = Math.max(...s.rows.map(r => r.length))
    const h = s.rows.length
    s.place = { gx: Math.round(27.5 - w / 2), gy: groundGridY - h, w, h }
  }
  return s.place
}

// ---------------------------------------------------------------- piranha
const piranhaPal = {
  o: '#6E1B10', d: '#C23B22', m: '#E85D3A', l: '#FF8C42', s: '#FFC24D',
  w: '#FFFFFF', b: '#181828', t: '#FFF6D8', k: '#F08A8A',
  g: '#2D5A27', G: '#4A8F3C', L: '#A8E063',
  n: '#5C3A1A', N: '#8B5A2B', B: '#B07842'
}
export const SPRITE_PIRANHA: Sprite = {
  pal: piranhaPal,
  meta: { eyeL: [5, 5, 3, 3], eyeR: [11, 5, 3, 3], eyeBg: piranhaPal.m, mouth: [4, 11, 12] },
  rows: [
    '.......oooooo.......',
    '.....oodddddoo......',
    '....odmmllllmdo.....',
    '...odmllsslllmdo....',
    '..odmlwwsslwwlmdo...',
    '..odmlbbwlwwbblmdo..',
    '.odmlwwblwwlwwblmdo.',
    '.odmllllllllllllmdo.',
    '.odmttttttttttttmdo.',
    '.odtbbbbbbbbbbbbtdo.',
    '.odbtbtbbbbbtbtbmdo.',
    '.odtbbbbbbbbbbbbmdo.',
    '.odttbbbbbbbbbbtmdo.',
    '..odtbtbbbbbbbtddo..',
    '..oddmmttttttmdddo..',
    '...oddmdddddmddo....',
    '....oggggggggo......',
    '..gL.oGGggggGo.lg...',
    '.gLggoGGnGGnGogLgg..',
    '..ggo.oGnnnnGo.ogg..',
    '.gg....onnnno....gg.',
    '.g......oooooo.....g.',
    '......oBBBBBBo......',
    '.....oBBBBBBBBo.....',
    '....oBBnnnnnnBBo....',
    '....oBnnNNNNnnBo....',
    '...oBnnnNNNnnnnBo...',
    '...obnnnnnnnnnnbo...',
    '....oooooooooooo....'
  ]
}

// ---------------------------------------------------------------- cactus
const cactusPal = {
  o: '#173A17', d: '#2D7A2D', m: '#3FA33F', l: '#66CC55', s: '#9BE87A',
  y: '#FFD93D', r: '#E85D3A', R: '#FF8C42', w: '#FFFFFF',
  n: '#5C3A1A', N: '#8B5A2B', B: '#B07842'
}
export const SPRITE_CACTUS: Sprite = {
  pal: cactusPal,
  meta: { eyeL: [7, 5, 3, 3], eyeR: [13, 5, 3, 3], eyeBg: cactusPal.m, mouth: [8, 9, 7] },
  rows: [
    '.........oyyo.........',
    '........orRRro........',
    '.........oyyo.........',
    '.......oommmmoo.......',
    '......ommllllmmо......'.replace('о', 'o'),
    '.....omlkmmmmklmmo....',
    '....odmmmmmmmmmmmdo...',
    '....odmdmmdmmdmmdo....',
    'oo.odmdmmdmmdmmdmdo..o'.slice(0, 22),
    'omo.odmdmmdmmdmmdo..omo',
    'ommo.odmdmmdmmdmmdo.ommo',
    '.ommoodmmmmmmmmmmoommo.',
    '..ommmmmmmmmmmmmmmmmo..',
    '...ommmmmmmmmmmmmmmo...',
    '....odddddddddddddd....',
    '.....oooooooooooooo....',
    '......oBBBBBBBBBo......',
    '.....oBBBnnnnnBBBo.....',
    '.....oBnnnNNNnnnBo.....',
    '....oBnnnnNNNnnnnBo....',
    '....obnnnnnnnnnnnbo....',
    '.....ooooooooooooo.....'
  ]
}

// ---------------------------------------------------------------- slime
const slimePal = {
  o: '#1F5F8B', d: '#2E86AB', m: '#54B9DF', l: '#8AD8EF', s: '#EAFBFF',
  b: '#181828', k: '#F08A8A', t: '#FFF6D8'
}
export const SPRITE_SLIME: Sprite = {
  pal: slimePal,
  meta: { eyeL: [6, 9, 3, 3], eyeR: [13, 9, 3, 3], eyeBg: slimePal.m, mouth: [9, 13, 4] },
  rows: [
    '........oooooo........',
    '......oomlllmmoo......',
    '.....omlssssllmmo.....',
    '....omlslllllllmmo....',
    '...ommsllmmmmmmmmo....',
    '..ommmmmmmmmmmmmmmo...',
    '..ommmmmmmmmmmmmmmo...',
    '.ommmmmmmmmmmmmmmmmo..',
    '.ommmmmmmmmmmmmmmmmo..',
    '.ommmbbbmmmmmbbbmmmo..',
    'ommmbbsbmmmmmbbsbmmmo.',
    'ommmbbbbmmkmmmbbbbmmo.',
    'ommmmmmmmkkmkmmmmmmmmo.',
    'ommmmmmmkkkkmmmmmmmmmo.',
    'ommmmmmmmmmmmmmmmmmmdo',
    'ommmmmmmmmmmmmmmmmmddo',
    'odmmmmmmmmmmmmmmmmdddo',
    'oddddddddddddddddddddo',
    '.oooooooooooooooooooo.'
  ]
}

// ---------------------------------------------------------------- cat
const catPal = {
  o: '#33304A', d: '#554F70', m: '#857DA6', l: '#A79FC4', s: '#DCD6F0',
  w: '#FFFFFF', b: '#181828', k: '#F08A8A', n: '#E89BB0'
}
export const SPRITE_CAT: Sprite = {
  pal: catPal,
  meta: { eyeL: [6, 9, 4, 3], eyeR: [14, 9, 4, 3], eyeBg: catPal.m, mouth: [11, 13, 3] },
  rows: [
    '..oo................oo..',
    '.oddo..............oddо.'.replace('о', 'o'),
    '.odndo............ondno.',
    '.odkdo....oommoo..odkdo.',
    '..oddommmmmmmmmmmmmoddo.',
    '..odmllmmmmmmmmmllmmmdo.',
    '.odmllmmmmmmmmmmmllmmmdo',
    '.odmmmmmmmmmmmmmmmmmmmdo',
    'odmmmbbwmmmmmmmwwbmmmmmo',
    'odmmmbwkbmmmmmmkwkbmmmmo',
    'odmmmbbbmmmmmmmbbbmmmmmo',
    'odmmmmmmmmknkmmmmmmmmmmo',
    'odmmmmmmmmwwwmmmmmmmmmmo',
    '.odmmmmmmmwwmmmmmmmmmmdo',
    '.odmmwwmmmmwwmmmwwmmmdo.',
    '.odmwwwwwwwwwwwwwwwmmdo.',
    '.odmwwwwwwwwwwwwwwwmmdo.',
    '..odmwwwwwwwwwwwwwwmmdo.',
    '..odmmmwwwwwwwwwmmmmdo..',
    '...odmmmmmmmmmmmmmmmdo..',
    '...odmmmmmmmmmmmmmmmdo..',
    '....oddddddddddddddddo..',
    '.....oooooooooooooooo...'
  ]
}

// ---------------------------------------------------------------- mushroom
const shroPal = {
  o: '#7A1515', d: '#C23B22', m: '#E85D3A', l: '#FF8C42', s: '#FFC24D',
  w: '#FFF6E0', W: '#FFFFFF', b: '#181828', k: '#F08A8A',
  n: '#C9AE72', N: '#F2DFB6', L: '#7BC95A', g: '#2D5A27'
}
export const SPRITE_MUSHROOM: Sprite = {
  pal: shroPal,
  meta: { eyeL: [5, 12, 3, 3], eyeR: [12, 12, 3, 3], eyeBg: shroPal.N, mouth: [9, 16, 3] },
  rows: [
    '.......oooooooo.......',
    '.....oollddddloo......',
    '...oolmmmddddmmloo....',
    '..olmmmdddddddddmmlo..',
    '.olmmWWdddddsdddWWmlo.',
    '.olmWWWdddddssdddWmlo.',
    'olmmWWdddddddssdddmlo.',
    'olmmddddddsdddddddmmlo',
    'olmmddddddddsdddssdmlo',
    '.ollllllllllllllllllo.',
    '..onNNNNNNNNNNNNNno...',
    '..onNNNNNNNNNNNNNno...',
    '..onNbwbNNNNNbwbNno...',
    '..onNbbNNNNNbbNNno....',
    '..onnNNNkkkNNNNnno....',
    '..onNNNNNbbNNNNNno....',
    '...onNNNNNNNNNNno.....',
    '....onnnnnnnnnno......',
    '.....oLLoo.ooLLo......',
    '....ogLo.....oLgo.....',
    '.....oo.......oo......'
  ]
}

// ---------------------------------------------------------------- ghost
const ghostPal = {
  o: '#49537A', d: '#8891B0', m: '#C6CCE4', l: '#EAEEFA', s: '#FFFFFF',
  b: '#232743', k: '#F08A8A'
}
export const SPRITE_GHOST: Sprite = {
  pal: ghostPal,
  meta: { eyeL: [5, 7, 4, 3], eyeR: [13, 7, 4, 3], eyeBg: ghostPal.l, mouth: [9, 12, 3] },
  rows: [
    '.......ooooooo.......',
    '.....oommmmmmmoo.....',
    '....ommllllllllmo....',
    '...ommllllllllllmo...',
    '..ommllmmllllmllmmo..',
    '..omllmmllllllmmlmo..',
    '.ommllmmlllllllmllmo.',
    '.ommllbbbbmmmlbbbbmo.',
    '.ommlmbwsbmmlmbwsbmo.',
    '.ommlmbbbbmmlmbbbbmo.',
    '.ommllmmmmmmmmmmmmmo.',
    '.ommkmmmmmbbmmmmmmmo.',
    '.ommmmmmmmbbbmmmmmmo.',
    '.ommmmmmmmbbmmmmmmmo.',
    '.ommmmmmmmmmmmmmmmmdo',
    '.ommmmmmmmmmmmmmmmddо'.replace('о', 'o'),
    '..ommmmmmmmmmmmmmddо.'.replace('о', 'o'),
    '...ommommmmmmmomо....'.replace('о', 'o'),
    '....o..oooooo..o.....'
  ]
}

// ---------------------------------------------------------------- dino
const dinoPal = {
  o: '#1E4D1E', d: '#3F8929', m: '#6ABE30', l: '#8FD94C', s: '#C6F273',
  w: '#FFFFFF', b: '#181828', t: '#FFF6D8'
}
export const SPRITE_DINO: Sprite = {
  pal: dinoPal,
  meta: { eyeL: [5, 3, 3, 3], eyeR: null, eyeBg: dinoPal.m, mouth: [4, 8, 6] },
  rows: [
    '......ooooooo.......o...',
    '.....oddddddmo.....odmo.',
    '....odmwslmmmо....odmmo.'.replace('о', 'o'),
    '....ombbwslmmo....odmmo..',
    '....ombbwslmmmo..odmmo...',
    '....odmmllmmmmoddmmo.....',
    '.....odmmmmmmmddddo......',
    '..oo.odmttmmmmmmmo.......',
    '.oddo.dmmmmmmmmmo........',
    '.odmoommmmmmmmmo.........',
    '..odmmmmmmmmmmmmo........',
    '..odmmmmmmdmmmmmo........',
    '...odmmmddddmmmmo........',
    '...odmmmddddmmmmo........',
    '....odmmmddmmmmdo........',
    '....odmmmmmmmmdmo........',
    '.....odmmmmmmmmdo........',
    '.....odmmmmmmmmdo........',
    '......odmmmmmmmdo........',
    '......odmmmdmmdo.........',
    '.....odmmdodmmmdo........',
    '....odmdo.odmdodo........',
    '....oddo...oddo.o........',
    '.....oo.....oo...........'
  ]
}

// ---------------------------------------------------------------- robot
const roboPal = {
  o: '#222A38', d: '#4A5568', m: '#8A97AD', l: '#C3CEDF', s: '#EFF4FB',
  G: '#7BF77B', R: '#FF4E50', y: '#FFD93D', b: '#0E1118'
}
export const SPRITE_ROBOT: Sprite = {
  pal: roboPal,
  meta: { eyeL: [8, 8, 4, 3], eyeR: [14, 8, 4, 3], eyeBg: roboPal.b, mouth: [10, 13, 6] },
  rows: [
    '...........yy...........',
    '...........yy...........',
    '..........oddo..........',
    '.......ooomddmooo.......',
    '.....oommmmmmmmmmmoo....',
    '....omllmmmmmmmmmlmo....',
    '...omlldbbbbbbbbdllmo...',
    '..omlldbddddddddbdllmo..',
    '..omldbdbbbbbbbdbdblmo..',
    '..omldbdbGGdbGGdbdblmo..',
    '..omldbdbbbbbbbdbdblmo..',
    '..ommldbdddddddddblmmo..',
    '..ommmlbdbbdbbdbblmmo...',
    '...ommmlbbbbbbbbblmmo...',
    '....oommmmllllmmmmoo....',
    '.....odmmmmmmmmmmmdo....',
    '....odmddddddddmmmmdo...',
    '....odmdddddmmmdddmDo...'.replace('D', 'd'),
    '....odmmdddddmmmmmmdo...',
    '....odmmmmmmmmmmmmmdo...',
    '.....odddddddddddddo....',
    '....oddooodddooodddo....',
    '....oddo..oddo..oddo....',
    '.....oo....oo....oo.....'
  ]
}

// ---------------------------------------------------------------- pumpkin
const pumpPal = {
  o: '#7A3A10', d: '#C05A1D', m: '#F28425', l: '#FFA64D', s: '#FFD08A',
  b: '#141420', G: '#FFE08A', g: '#2D5A27', L: '#7BC95A', n: '#4A8F3C'
}
export const SPRITE_PUMPKIN: Sprite = {
  pal: pumpPal,
  meta: { eyeL: [7, 12, 4, 3], eyeR: [17, 12, 4, 3], eyeBg: pumpPal.m, mouth: [7, 16, 13] },
  rows: [
    '............ogo.........',
    '...........ognо.........'.replace('о', 'o'),
    '...........ognо.........'.replace('о', 'o'),
    '........oooonnnooo.......',
    '.....oommmmmmmmmmmoo.....',
    '...ommmmmmllmmmmmmmmmo...',
    '..ommmmllllmmmmmmmmmmmo..',
    '..ommllmmmmmmmddmmmmmmdo.',
    '.ommllmmmmmmmmmddmmmmmmdo',
    '.ommmmmGGGmmmdddmmmGGGmmo',
    'ommmmmGGGGGmmmddmmGGGGGmmo',
    'ommmmmmGGGmmmmmmmmmmmmmmmo',
    'ommmmmmmmmmmmmmmmmmmmmmmmo',
    'ommmmmbbbmmmmmmmmmbbbmmmmo',
    'ommmmmbsbbmmmmmmmbsbbmmmo.',
    'ommmmmmmmmmmmmmmmmmmmmmmdo',
    'ommmmmbbbbbbbbbbbbbbbmmmdo',
    'ommmmbGbGbGbGbGbGbGbmmmddo',
    'ommmmmbbbbbbbbbbbbbbmmmddo',
    '.ommmmmmmmmmmmmmmmmmmmddo.',
    '..ommmmmmmmmmmmmmmmmmmddo.',
    '...ommmmmmmmmmmmmmmmmddo..',
    '....oddddddddddddddddddo..',
    '.....oooooooooooooooooo...'
  ]
}

// ---------------------------------------------------------------- penguin
const pengPal = {
  o: '#10141C', d: '#20283A', m: '#39445C', l: '#FFFFFF', s: '#F4F7FF',
  y: '#FFB347', Y: '#E8912D', b: '#141420', k: '#F08A8A'
}
export const SPRITE_PENGUIN: Sprite = {
  pal: pengPal,
  meta: { eyeL: [6, 6, 3, 3], eyeR: [12, 6, 3, 3], eyeBg: pengPal.l, mouth: [9, 9, 4] },
  rows: [
    '.......oooooo.......',
    '.....oommmmmmoo.....',
    '....ommmmmmmmmmo....',
    '...ommmmmmmmmmmmo...',
    '..ommllllllllllmmo..',
    '..ommllllllllllmmo..',
    '.ommllbbllllbbllmmo.',
    '.ommllsbbllsbbllmmo.',
    '.ommlllllyylllllmmо.'.replace('о', 'o'),
    '.ommlllllyylllllmmo.',
    '.ommkllllllllllkmmo.',
    '.ommllllllllllllmmo.',
    'odmmllllllllllllmmdo',
    'odmmllllllllllllmmdo',
    'odmllllllllllllllmdo',
    'odmmllllllllllllmmо.'.replace('о', 'o'),
    '.odmllllllllllllmmdo',
    '.odmmllllllllllmmmo.',
    '..odmmllllllllmmddo.',
    '...odmmmmmmmmmmdddo.',
    '....oddddddddddddo..',
    '.....oYYo...oYYo....',
    '....oYYYo....oYYYo..',
    '.....ooo......ooo...'
  ]
}

// ---------------------------------------------------------------- alien
const alienPal = {
  o: '#123B12', d: '#2E7D32', m: '#57C84D', l: '#8FE08A', s: '#C8FFC4',
  b: '#181828', w: '#FFFFFF', r: '#FF4E50'
}
export const SPRITE_ALIEN: Sprite = {
  pal: alienPal,
  meta: { eyeL: [5, 10, 4, 3], eyeR: [13, 10, 4, 3], eyeBg: alienPal.b, mouth: [7, 15, 9] },
  rows: [
    '..or...........rо.....'.replace('о', 'o'),
    '...or.........ro......',
    '...odo........odo.....',
    '....odo......odo......',
    '.....odooooooodo......',
    '....odmllllllmmo......',
    '...odmllllllllmmo.....',
    '..odmllllllllllmmo....',
    '.odmllbbbbbbbbblmmo...',
    '.odmlbbbbbbbbbbbbmmo..',
    'odmlbbwwbbbbbbwwbbmmo.',
    'odmlbbwsbbbbbbswbbmmo.',
    'odmmbbbbbbbbbbbbbbmmo.',
    'odmmmmbbbbbbbbbmmmmo..',
    'odmmmmbbwwwwwbbmmmmo..',
    '.odmmmmbbbbbbbmmmmо...'.replace('о', 'o'),
    '.odmmmmmmmmmmmmmmо....'.replace('о', 'o'),
    '..odmmmmmmmmmmmmmo....',
    '...oddo.oddo.odo......',
    '....odo..odo..odo.....',
    '.....oo...oo...oo.....'
  ]
}

// ---------------------------------------------------------------- fox
const foxPal = {
  o: '#5C2A0D', d: '#B85C1E', m: '#E8823A', l: '#FFA85C', s: '#FFDCA8',
  w: '#FFFFFF', b: '#181828', k: '#F08A8A', t: '#FFF6D8'
}
export const SPRITE_FOX: Sprite = {
  pal: foxPal,
  meta: { eyeL: [5, 9, 4, 3], eyeR: [15, 9, 4, 3], eyeBg: foxPal.m, mouth: [11, 15, 3] },
  rows: [
    '..oo................oo..',
    '.oddo..............oddo.',
    '.odkdo............odkdo.',
    '.odkdo...oommoo...odkdo.',
    '..oddommmmmmmmmmmmmodo..',
    '..odmmllmmmmmmmmllmmmdo.',
    '.odmmllmmmmmmmmmmllmmmo.',
    '.odmmmmmmmmmmmmmmmmmmo..',
    'odmmmbbmmmmmmmmmmbbmmo..',
    'odmmbwsbmmmmmmmbsbmmmmo.',
    'odmmmbbbmmmmmmmbbbmmmmo.',
    'odmmmmmmmmmwwmmmmmmmmo..',
    'odmmmmmmmwwwuwmmmmmmmo..'.replace('u', 'w'),
    '.odmmmmmwwbbwwmmmmmmо...'.replace('о', 'o'),
    '.odmmmmmwwbbwwmmmmmmdo..',
    '.odmmmmwwwwwwwmmmmmmdo..',
    '..odmmmwwwwwwwmmmmmmdo..',
    '...odmmwwwwwwmmmmmmddo..',
    '...odmmmmmmmmmmmmmddo...',
    '...odmmmwwwwwmmmmmmdo...',
    '....odmmmmmmmmmmmmddo...',
    '....odmmmmmmmmmmmmmdo...',
    '.....odmmmmmmmmmmmmdo...',
    '.....odmmdoodmmmdmddo...',
    '....odmdo..odmdodddo....',
    '....oddo...oddo.ooo.....',
    '.....oo.....oo..........'
  ]
}
